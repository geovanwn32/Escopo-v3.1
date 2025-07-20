
import type { Employee } from "@/types/employee";
import { differenceInMonths } from 'date-fns';

interface ThirteenthParams {
    employee: Employee;
    year: number;
    parcel: 'first' | 'second' | 'unique';
}

interface ThirteenthEvent {
    descricao: string;
    referencia: string;
    provento: number;
    desconto: number;
}

export interface ThirteenthResult {
    events: ThirteenthEvent[];
    totalProventos: number;
    totalDescontos: number;
    liquido: number;
}

// --- Tabelas de Impostos (podem ser compartilhadas em um arquivo utilitário) ---
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
    return { value: 0, rate: 0 }; // Should not be reached
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

export function calculateThirteenth(params: ThirteenthParams): ThirteenthResult {
    const { employee, year, parcel } = params;
    const events: ThirteenthEvent[] = [];
    const baseSalary = employee.salarioBase;

    // --- PROVENTOS ---
    const monthsWorked = Math.min(12, differenceInMonths(new Date(year, 11, 31), employee.dataAdmissao) + 1);
    const fullThirteenth = (baseSalary / 12) * monthsWorked;

    let totalProventos = 0;
    
    if (parcel === 'first') {
        const firstParcelValue = fullThirteenth / 2;
        events.push({
            descricao: 'Adiantamento 13º Salário (1ª Parcela)',
            referencia: `${monthsWorked}/12`,
            provento: parseFloat(firstParcelValue.toFixed(2)),
            desconto: 0,
        });
        totalProventos = firstParcelValue;

    } else if (parcel === 'second') {
        const firstParcelValue = fullThirteenth / 2; // Assume first parcel was paid
        events.push({
            descricao: '13º Salário Integral',
            referencia: `${monthsWorked}/12`,
            provento: parseFloat(fullThirteenth.toFixed(2)),
            desconto: 0,
        });
        events.push({
            descricao: 'Adiantamento 13º Salário (Pago na 1ª Parcela)',
            referencia: '',
            provento: 0,
            desconto: parseFloat(firstParcelValue.toFixed(2)),
        });
        totalProventos = fullThirteenth;

    } else { // unique parcel
        events.push({
            descricao: '13º Salário (Parcela Única)',
            referencia: `${monthsWorked}/12`,
            provento: parseFloat(fullThirteenth.toFixed(2)),
            desconto: 0,
        });
        totalProventos = fullThirteenth;
    }

    // --- DESCONTOS (only on second or unique parcel) ---
    let totalDescontos = events.reduce((acc, event) => acc + event.desconto, 0);

    if (parcel === 'second' || parcel === 'unique') {
        // INSS
        const inss = calculateINSS(fullThirteenth);
        if (inss.value > 0) {
            events.push({
                descricao: 'INSS sobre 13º Salário',
                referencia: `${inss.rate.toFixed(2)}%`,
                provento: 0,
                desconto: inss.value,
            });
            totalDescontos += inss.value;
        }

        // IRRF
        const numDependentesIRRF = employee.dependentes?.filter(d => d.isIRRF).length || 0;
        const irrf = calculateIRRF(fullThirteenth, numDependentesIRRF, inss.value);
        if (irrf.value > 0) {
            events.push({
                descricao: 'IRRF sobre 13º Salário',
                referencia: `${irrf.rate.toFixed(2)}%`,
                provento: 0,
                desconto: irrf.value,
            });
            totalDescontos += irrf.value;
        }
    }
    
    // --- CÁLCULO FINAL ---
    const liquido = totalProventos - totalDescontos;

    return {
        events,
        totalProventos: parseFloat(totalProventos.toFixed(2)),
        totalDescontos: parseFloat(totalDescontos.toFixed(2)),
        liquido: parseFloat(liquido.toFixed(2)),
    };
}
