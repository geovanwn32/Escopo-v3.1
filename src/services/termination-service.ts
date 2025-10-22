

import type { Employee } from "@/types/employee";
import { differenceInMonths, differenceInDays, getDaysInMonth, addMonths } from 'date-fns';

interface TerminationParams {
    employee: Employee;
    terminationDate: Date;
    reason: string; // e.g., 'dispensa_sem_justa_causa', 'pedido_demissao'
    noticeType: string; // e.g., 'indenizado', 'trabalhado'
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

// --- Tabelas de Impostos (podem ser compartilhadas) ---
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

function calculateINSS(base: number): { value: number, rate: number } {
    if (base <= 0) return { value: 0, rate: 0 };
    if (base > inssBrackets[inssBrackets.length - 1].limit) {
        return { value: inssCeiling, rate: 14 };
    }
    for (const bracket of inssBrackets) {
        if (base <= bracket.limit) {
            return {
                value: parseFloat(((base * bracket.rate) - bracket.deduction).toFixed(2)),
                rate: bracket.rate * 100
            };
        }
    }
    return { value: 0, rate: 0 };
}

function calculateIRRF(base: number, dependents: number, inssDeduction: number): { value: number, rate: number } {
    const baseAfterInss = base - inssDeduction;
    if (baseAfterInss <= 0) return { value: 0, rate: 0 };
    
    const totalDependentDeduction = dependents * irrfDependentDeduction;
    const baseAfterDependents = baseAfterInss - totalDependentDeduction;

    let irrfValue = 0;
    let rate = 0;
    for (const bracket of irrfBrackets) {
        if (baseAfterDependents <= bracket.limit) {
            irrfValue = (baseAfterDependents * bracket.rate) - bracket.deduction;
            rate = bracket.rate * 100;
            break;
        }
    }

    return { value: parseFloat(Math.max(0, irrfValue).toFixed(2)), rate };
}


export function calculateTermination(params: TerminationParams): TerminationResult {
    const { employee, terminationDate, reason, noticeType, fgtsBalance } = params;
    const events: TerminationEvent[] = [];
    const baseSalary = employee.salarioBase;
    
    const daysInTerminationMonth = getDaysInMonth(terminationDate);
    const workedDaysInMonth = terminationDate.getDate();

    // --- VERBAS RESCISÓRIAS (PROVENTOS) ---
    // 1. Saldo de Salário
    const saldoSalario = (baseSalary / daysInTerminationMonth) * workedDaysInMonth;
    events.push({ descricao: 'Saldo de Salário', referencia: `${workedDaysInMonth} dias`, provento: saldoSalario, desconto: 0 });

    // 2. Aviso Prévio Indenizado
    let avisoPrevio = 0;
    if (reason === 'dispensa_sem_justa_causa' && noticeType === 'indenizado') {
        avisoPrevio = baseSalary; // Simplificado, poderia incluir anos de serviço
        events.push({ descricao: 'Aviso Prévio Indenizado', referencia: '30 dias', provento: avisoPrevio, desconto: 0 });
    }

    // 3. Férias Vencidas + 1/3 (se houver)
    // Lógica simplificada: assume que não há férias vencidas para este cálculo.

    // 4. Férias Proporcionais + 1/3
    const monthsWorkedInPeriod = (differenceInMonths(terminationDate, employee.dataAdmissao) % 12) + 1;
    const feriasProporcionais = (baseSalary / 12) * monthsWorkedInPeriod;
    const tercoFeriasProporcionais = feriasProporcionais / 3;
    events.push({ descricao: 'Férias Proporcionais', referencia: `${monthsWorkedInPeriod}/12`, provento: feriasProporcionais, desconto: 0 });
    events.push({ descricao: '1/3 sobre Férias Proporcionais', referencia: '', provento: tercoFeriasProporcionais, desconto: 0 });

    // 5. 13º Salário Proporcional
    const mesesTrabalhados13 = terminationDate.getMonth() + 1;
    const decimoTerceiroProporcional = (baseSalary / 12) * mesesTrabalhados13;
    events.push({ descricao: '13º Salário Proporcional', referencia: `${mesesTrabalhados13}/12`, provento: decimoTerceiroProporcional, desconto: 0 });

    // --- DEDUÇÕES ---
    
    // Base de INSS para Saldo de Salário e 13º
    const baseINSS_Salario = saldoSalario;
    const baseINSS_13 = decimoTerceiroProporcional;

    // Cálculo INSS
    const inssSalario = calculateINSS(baseINSS_Salario);
    if (inssSalario.value > 0) {
        events.push({ descricao: 'INSS sobre Saldo de Salário', referencia: `${inssSalario.rate}%`, provento: 0, desconto: inssSalario.value });
    }
    const inss13 = calculateINSS(baseINSS_13);
     if (inss13.value > 0) {
        events.push({ descricao: 'INSS sobre 13º Salário', referencia: `${inss13.rate}%`, provento: 0, desconto: inss13.value });
    }
    
    // Base de IRRF
    const numDependentesIRRF = employee.dependentes?.filter(d => d.isIRRF).length || 0;
    const baseIRRF = (saldoSalario + feriasProporcionais + tercoFeriasProporcionais + decimoTerceiroProporcional);
    const totalINSSDeduction = inssSalario.value + inss13.value;
    const irrf = calculateIRRF(baseIRRF, numDependentesIRRF, totalINSSDeduction);
     if (irrf.value > 0) {
        events.push({ descricao: 'IRRF sobre Rescisão', referencia: `${irrf.rate}%`, provento: 0, desconto: irrf.value });
    }

    // Multa FGTS (se aplicável)
    if (reason === 'dispensa_sem_justa_causa' && fgtsBalance > 0) {
        const multaFgts = fgtsBalance * 0.40;
        events.push({ descricao: 'Multa de 40% sobre FGTS', referencia: '', provento: multaFgts, desconto: 0 });
    }


    // --- CÁLCULO FINAL ---
    const totalProventos = events.reduce((acc, event) => acc + event.provento, 0);
    const totalDescontos = events.reduce((acc, event) => acc + event.desconto, 0);
    const liquido = totalProventos - totalDescontos;

    return {
        events,
        totalProventos: parseFloat(totalProventos.toFixed(2)),
        totalDescontos: parseFloat(totalDescontos.toFixed(2)),
        liquido: parseFloat(liquido.toFixed(2)),
    };
}
