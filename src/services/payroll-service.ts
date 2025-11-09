

import type { Employee } from "@/types/employee";
import type { PayrollEvent } from "@/types";
import { Socio } from "@/types";

// --- Tabela INSS 2024 ---
const inssBrackets = [
    { limit: 1412.00, rate: 0.075, deduction: 0 },
    { limit: 2666.68, rate: 0.09, deduction: 21.18 },
    { limit: 4000.03, rate: 0.12, deduction: 101.18 },
    { limit: 7786.02, rate: 0.14, deduction: 181.18 },
];
const inssCeiling = 908.85;

// --- Tabela IRRF 2024 ---
const irrfBrackets = [
    { limit: 2259.20, rate: 0, deduction: 0 },
    { limit: 2826.65, rate: 0.075, deduction: 169.44 },
    { limit: 3751.05, rate: 0.15, deduction: 381.44 },
    { limit: 4664.68, rate: 0.225, deduction: 662.77 },
    { limit: Infinity, rate: 0.275, deduction: 896.00 },
];
const irrfDependentDeduction = 189.59;
const simplifiedDeduction = 564.80;

export interface PayrollCalculationResult {
    events: PayrollEvent[];
    totalProventos: number;
    totalDescontos: number;
    liquido: number;
    baseINSS: number;
    baseIRRF: number;
    baseFGTS: number;
    fgts: { valor: number };
    inss: { valor: number; aliquota: number };
    irrf: { valor: number; aliquota: number };
}

function calculateINSS(baseInss: number, isSocio: boolean): { valor: number; aliquota: number } {
    if (baseInss <= 0) return { valor: 0, aliquota: 0 };
    
    if (isSocio) {
        const inssValue = baseInss * 0.11;
        // The INSS for pro-labore is 11% but also capped at the INSS ceiling.
        const finalValue = Math.min(inssValue, inssCeiling);
        return { valor: parseFloat(finalValue.toFixed(2)), aliquota: 11 };
    }

    // Check against ceiling first for CLT
    if (baseInss > inssBrackets[inssBrackets.length - 1].limit) {
        return { valor: inssCeiling, aliquota: 14 }; // Effective rate is not 14, but it's the top bracket.
    }

    let calculatedInss = 0;
    let effectiveRate = 0;
    
    for (const bracket of inssBrackets) {
        if (baseInss <= bracket.limit) {
            calculatedInss = (baseInss * bracket.rate) - bracket.deduction;
            effectiveRate = bracket.rate * 100;
            break;
        }
    }

    return { valor: parseFloat(calculatedInss.toFixed(2)), aliquota: effectiveRate };
}


function calculateIRRF(baseIrrf: number, dependents: number, inssDeduction: number): { value: number, rate: number } {
    const baseAfterInss = baseIrrf - inssDeduction;
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


export function calculatePayroll(employee: Employee | (Socio & { isSocio?: boolean }), events: PayrollEvent[]): PayrollCalculationResult {
    const isSocio = 'proLabore' in employee || (employee as any).isSocio;

    const baseFGTS = events
        .filter(e => e.rubrica.incideFGTS && e.rubrica.tipo === 'provento')
        .reduce((acc, e) => acc + (e.provento || 0), 0);

    const baseINSS = events
        .filter(e => e.rubrica.incideINSS && e.rubrica.tipo === 'provento')
        .reduce((acc, e) => acc + (e.provento || 0), 0);
        
    const inss = calculateINSS(baseINSS, isSocio);
    const inssEvent: PayrollEvent = {
        id: 'inss',
        rubrica: { id: 'inss', codigo: '901', descricao: 'INSS SOBRE SALÁRIO', tipo: 'desconto', incideINSS: false, incideFGTS: false, incideIRRF: false, naturezaESocial: '9201' },
        referencia: inss.aliquota,
        provento: 0,
        desconto: inss.valor,
    };

    const baseIRRF = events
        .filter(e => e.rubrica.incideIRRF && e.rubrica.tipo === 'provento')
        .reduce((acc, e) => acc + (e.provento || 0), 0);
    
    const numDependentesIRRF = !isSocio ? (employee as Employee).dependentes?.filter(d => d.isIRRF).length || 0 : 0;
    
    const irrf = calculateIRRF(baseIRRF, numDependentesIRRF, inss.valor);
    const irrfEvent: PayrollEvent = {
        id: 'irrf',
        rubrica: { id: 'irrf', codigo: '902', descricao: 'IRRF SOBRE SALÁRIO', tipo: 'desconto', incideINSS: false, incideFGTS: false, incideIRRF: false, naturezaESocial: '9202' },
        referencia: irrf.rate,
        provento: 0,
        desconto: irrf.value,
    };

    const fgts = { valor: isSocio ? 0 : parseFloat((baseFGTS * 0.08).toFixed(2)) };
    
    const finalEvents = [...events];
    if (inss.valor > 0) finalEvents.push(inssEvent);
    if (irrf.value > 0) finalEvents.push(irrfEvent);

    const totalProventos = finalEvents.filter(e => e.rubrica.tipo === 'provento').reduce((acc, e) => acc + (e.provento || 0), 0);
    const totalDescontos = finalEvents.filter(e => e.rubrica.tipo === 'desconto').reduce((acc, e) => acc + (e.desconto || 0), 0);
    const liquido = totalProventos - totalDescontos;

    return {
        events: finalEvents,
        totalProventos: parseFloat(totalProventos.toFixed(2)),
        totalDescontos: parseFloat(totalDescontos.toFixed(2)),
        liquido: parseFloat(liquido.toFixed(2)),
        baseINSS,
        baseIRRF,
        baseFGTS,
        fgts,
        inss,
        irrf,
    };
}
