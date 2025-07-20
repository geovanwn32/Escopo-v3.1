
import type { Employee } from "@/types/employee";
import { differenceInMonths, differenceInDays, getDaysInMonth, addMonths } from 'date-fns';

interface VacationParams {
    employee: Employee;
    startDate: Date;
    vacationDays: number;
    sellVacation: boolean; // abono pecuniário
    advanceThirteenth: boolean;
}

interface VacationEvent {
    descricao: string;
    referencia: string;
    provento: number;
    desconto: number;
}

export interface VacationResult {
    events: VacationEvent[];
    totalProventos: number;
    totalDescontos: number;
    liquido: number;
}

// --- Tabelas de Impostos ---
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
const simplifiedDeduction = 564.80;

// --- Funções de Cálculo de Imposto ---
function calculateINSS(base: number, description: string): VacationEvent | null {
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

function calculateIRRF(base: number, dependents: number, inssDeduction: number, description: string): VacationEvent | null {
    const baseAfterInss = base - inssDeduction;
    if (baseAfterInss <= 0) return null;
    
    // Deductions for dependents
    const totalDependentDeduction = dependents * irrfDependentDeduction;
    const baseAfterDependents = baseAfterInss - totalDependentDeduction;

    // Simplified deduction is an option for the taxpayer
    const baseSimplified = baseAfterInss - simplifiedDeduction;

    let irrfStandard = 0;
    for (const bracket of irrfBrackets) {
        if (baseAfterDependents <= bracket.limit) {
            irrfStandard = (baseAfterDependents * bracket.rate) - bracket.deduction;
            break;
        }
    }
    
    let irrfSimplified = 0;
     for (const bracket of irrfBrackets) {
        if (baseSimplified <= bracket.limit) {
            irrfSimplified = (baseSimplified * bracket.rate) - bracket.deduction;
            break;
        }
    }

    const finalIrrf = Math.max(0, Math.min(irrfStandard, irrfSimplified));

    if (finalIrrf <= 0) return null;

     return {
        descricao: `IRRF sobre ${description}`,
        referencia: '',
        provento: 0,
        desconto: parseFloat(finalIrrf.toFixed(2)),
    };
}


export function calculateVacation(params: VacationParams): VacationResult {
    const { employee, startDate, vacationDays, sellVacation, advanceThirteenth } = params;
    const events: VacationEvent[] = [];
    const baseSalary = employee.salarioBase;

    // --- PROVENTOS ---

    // 1. Férias Normais
    const normalVacationPay = (baseSalary / 30) * vacationDays;
    events.push({
        descricao: 'Férias',
        referencia: `${vacationDays} dias`,
        provento: parseFloat(normalVacationPay.toFixed(2)),
        desconto: 0,
    });

    // 2. Terço Constitucional sobre Férias
    const oneThirdBonus = normalVacationPay / 3;
    events.push({
        descricao: '1/3 Constitucional de Férias',
        referencia: '',
        provento: parseFloat(oneThirdBonus.toFixed(2)),
        desconto: 0,
    });

    // 3. Abono Pecuniário (Venda de Férias)
    let abonoPay = 0;
    let abonoBonus = 0;
    if (sellVacation) {
        abonoPay = (baseSalary / 30) * 10;
        abonoBonus = abonoPay / 3;
        events.push({
            descricao: 'Abono Pecuniário',
            referencia: '10 dias',
            provento: parseFloat(abonoPay.toFixed(2)),
            desconto: 0,
        });
        events.push({
            descricao: '1/3 sobre Abono Pecuniário',
            referencia: '',
            provento: parseFloat(abonoBonus.toFixed(2)),
            desconto: 0,
        });
    }

    // 4. Adiantamento 13º Salário
    let thirteenthAdvance = 0;
    if (advanceThirteenth) {
        thirteenthAdvance = baseSalary / 2;
        events.push({
            descricao: 'Adiantamento 1ª Parcela 13º Salário',
            referencia: '',
            provento: parseFloat(thirteenthAdvance.toFixed(2)),
            desconto: 0,
        });
    }

    // --- DESCONTOS ---
    
    // INSS
    const inssBase = normalVacationPay; // INSS incide apenas sobre as férias normais
    const inssEvent = calculateINSS(inssBase, 'Férias');
    if (inssEvent) events.push(inssEvent);
    const inssValue = inssEvent?.desconto || 0;

    // IRRF
    // Base IRRF = Férias + 1/3 - INSS - Dependentes. Abono e adiantamento 13º têm tributação exclusiva.
    const irrfBase = normalVacationPay + oneThirdBonus;
    const irrfEvent = calculateIRRF(irrfBase, employee.dependentes, inssValue, 'Férias');
    if (irrfEvent) events.push(irrfEvent);

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
