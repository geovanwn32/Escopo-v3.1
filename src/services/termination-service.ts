import type { Employee } from "@/types/employee";
import { differenceInMonths, differenceInDays, getDaysInMonth, addMonths } from 'date-fns';

interface TerminationParams {
    employee: Employee;
    terminationDate: Date;
    reason: string; // 'dispensa_sem_justa_causa', 'pedido_demissao'
    noticeType: string; // 'indenizado', 'trabalhado'
    fgtsBalance: number;
}

interface TerminationEvent {
    descricao: string;
    referencia: string;
    provento: number;
    desconto: number;
}

export interface TerminationResult {
    events: TerminationEvent[];
    totalProventos: number;
    totalDescontos: number;
    liquido: number;
}

const inssBrackets = [
    { limit: 1412.00, rate: 0.075, deduction: 0 },
    { limit: 2666.68, rate: 0.09, deduction: 21.18 },
    { limit: 4000.03, rate: 0.12, deduction: 101.18 },
    { limit: 7786.02, rate: 0.14, deduction: 181.18 },
];
const inssCeiling = 908.85;

const irrfBrackets = [
    { limit: 2259.20, rate: 0, deduction: 0 },
    { limit: 2826.65, rate: 0.075, deduction: 169.44 },
    { limit: 3751.05, rate: 0.15, deduction: 381.44 },
    { limit: 4664.68, rate: 0.225, deduction: 662.77 },
    { limit: Infinity, rate: 0.275, deduction: 896.00 },
];
const irrfDependentDeduction = 189.59;


function calculateINSS(base: number, description: string): TerminationEvent | null {
    if (base <= 0) return null;

    let inssValue = 0;
    if (base > inssBrackets[inssBrackets.length - 1].limit) {
        inssValue = inssCeiling;
    } else {
        for (const bracket of inssBrackets) {
            if (base <= bracket.limit) {
                inssValue = (base * bracket.rate) - bracket.deduction;
                break;
            }
        }
    }
    
    if (inssValue <= 0) return null;

    return {
        descricao: `INSS sobre ${description}`,
        referencia: `${(inssValue / base * 100).toFixed(2)}%`,
        provento: 0,
        desconto: parseFloat(inssValue.toFixed(2)),
    };
}


export function calculateTermination(params: TerminationParams): TerminationResult {
    const { employee, terminationDate, reason, noticeType, fgtsBalance } = params;
    const events: TerminationEvent[] = [];
    const baseSalary = employee.salarioBase;

    // --- Verbas Rescisórias (Proventos) ---

    // 1. Saldo de Salário
    const daysInMonth = getDaysInMonth(terminationDate);
    const workedDays = terminationDate.getDate();
    const salaryBalance = (baseSalary / daysInMonth) * workedDays;
    events.push({
        descricao: 'Saldo de Salário',
        referencia: `${workedDays} dias`,
        provento: parseFloat(salaryBalance.toFixed(2)),
        desconto: 0,
    });

    // 2. Aviso Prévio
    let noticeDays = 30 + Math.floor(differenceInMonths(terminationDate, employee.dataAdmissao) / 12) * 3;
    if (noticeDays > 90) noticeDays = 90;
    
    let compensatedNoticeValue = 0;
    const projectedDate = addMonths(terminationDate, Math.floor(noticeDays / 30));

    if (reason === 'dispensa_sem_justa_causa' && noticeType === 'indenizado') {
        compensatedNoticeValue = (baseSalary / 30) * noticeDays;
        events.push({
            descricao: 'Aviso Prévio Indenizado',
            referencia: `${noticeDays} dias`,
            provento: parseFloat(compensatedNoticeValue.toFixed(2)),
            desconto: 0,
        });
    }

    // 3. Férias Proporcionais + 1/3
    const admissionYear = employee.dataAdmissao.getFullYear();
    const terminationYear = projectedDate.getFullYear();
    
    // Logic for proportional vacation
    let proportionalMonths = differenceInMonths(projectedDate, new Date(terminationYear, 0, 1)) + 1;
    if (projectedDate.getDate() < 15) {
        proportionalMonths--;
    }
    const proportionalVacation = (baseSalary / 12) * proportionalMonths;
    const proportionalVacationBonus = proportionalVacation / 3;
    if(proportionalVacation > 0) {
        events.push({
            descricao: 'Férias Proporcionais',
            referencia: `${proportionalMonths}/12`,
            provento: parseFloat(proportionalVacation.toFixed(2)),
            desconto: 0,
        });
         events.push({
            descricao: '1/3 sobre Férias Proporcionais',
            referencia: '',
            provento: parseFloat(proportionalVacationBonus.toFixed(2)),
            desconto: 0,
        });
    }
    
    // 4. 13º Salário Proporcional
    const thirteenthMonths = differenceInMonths(projectedDate, new Date(terminationYear, 0, 1)) + 1;
    const proportionalThirteenth = (baseSalary / 12) * thirteenthMonths;
     if(proportionalThirteenth > 0) {
        events.push({
            descricao: '13º Salário Proporcional',
            referencia: `${thirteenthMonths}/12`,
            provento: parseFloat(proportionalThirteenth.toFixed(2)),
            desconto: 0,
        });
    }

    // --- FGTS e Multa (Informativo/Base para outros cálculos, mas não entra no líquido) ---
     if (reason === 'dispensa_sem_justa_causa') {
        const fgtsOnTermination = (salaryBalance + proportionalThirteenth) * 0.08;
        const fgtsFine = (fgtsBalance + fgtsOnTermination) * 0.40;
         events.push({
            descricao: 'Multa de 40% sobre FGTS (valor a ser pago via GRRF)',
            referencia: '',
            provento: parseFloat(fgtsFine.toFixed(2)),
            desconto: 0,
        });
    }

    // --- Descontos ---

    // INSS Calculation
    const inssBaseSalary = salaryBalance;
    const inssEventSalary = calculateINSS(inssBaseSalary, 'Saldo de Salário');
    if(inssEventSalary) events.push(inssEventSalary);
    
    const inssBaseThirteenth = proportionalThirteenth;
    const inssEventThirteenth = calculateINSS(inssBaseThirteenth, '13º Salário');
    if(inssEventThirteenth) events.push(inssEventThirteenth);

    const totalInss = (inssEventSalary?.desconto || 0) + (inssEventThirteenth?.desconto || 0);

    // TODO: IRRF Calculation
    
    // Final Calculation
    const totalProventos = events.reduce((acc, event) => acc + event.provento, 0);
    const totalDescontos = events.reduce((acc, event) => acc + event.desconto, 0);
    const liquido = totalProventos - totalDescontos;

    return {
        events,
        totalProventos,
        totalDescontos,
        liquido,
    };
}
