
import type { Employee } from "@/types/employee";
import type { Rubrica } from "@/types/rubrica";
import type { PayrollEvent } from "@/types";

const familyAllowanceBracket = {
    limit: 1819.26,
    valuePerDependent: 62.04
};

const minimumWage2024 = 1412.00;

interface CalculatedEvent {
    referencia: number;
    provento: number;
    desconto: number;
}

export function calculateAutomaticEvent(
    rubrica: Rubrica,
    employee: Employee,
    allEvents: PayrollEvent[],
    reference?: number
): Partial<CalculatedEvent> | null {

    const baseSalary = employee.salarioBase;

    // Correctly determine the calculation base by summing all relevant earnings
    const inssCalculationBase = allEvents
        .filter(e => e.rubrica.incideINSS)
        .reduce((sum, e) => sum + e.provento, 0);

    const numDependentesSalarioFamilia = employee.dependentes?.filter(d => d.isSalarioFamilia).length || 0;

    if (rubrica.codigo === '0005') { 
        if (inssCalculationBase <= familyAllowanceBracket.limit && numDependentesSalarioFamilia > 0) {
            return {
                referencia: numDependentesSalarioFamilia,
                provento: numDependentesSalarioFamilia * familyAllowanceBracket.valuePerDependent,
                desconto: 0,
            };
        }
        return { referencia: numDependentesSalarioFamilia || 0, provento: 0, desconto: 0 };
    }

    if (rubrica.codigo === '0004') {
        const discount = baseSalary * 0.06;
        return {
            referencia: 6,
            provento: 0,
            desconto: discount,
        };
    }

    if (rubrica.descricao.toLowerCase().includes('horas extras 50%')) {
        const hourlyRate = baseSalary / 220;
        const overtimePay = hourlyRate * 1.5 * (reference || 0);
        return {
            provento: parseFloat(overtimePay.toFixed(2)),
            desconto: 0,
            referencia: reference || 0,
        }
    }
    
    if (rubrica.descricao.toLowerCase().includes('adicional noturno')) {
        const hourlyRate = baseSalary / 220;
        const nightShiftPremium = hourlyRate * 0.20 * (reference || 0);
        return {
            provento: parseFloat(nightShiftPremium.toFixed(2)),
            desconto: 0,
            referencia: reference || 0,
        }
    }
    
    if (rubrica.descricao.toLowerCase().includes('periculosidade')) {
        const hazardPay = baseSalary * 0.30;
        return {
            provento: parseFloat(hazardPay.toFixed(2)),
            desconto: 0,
            referencia: 30,
        }
    }
    
    if (rubrica.descricao.toLowerCase().includes('insalubridade')) {
        let rate = 0;
        if (rubrica.descricao.includes('10%') || rubrica.descricao.toLowerCase().includes('mínimo')) rate = 0.10;
        if (rubrica.descricao.includes('20%') || rubrica.descricao.toLowerCase().includes('médio')) rate = 0.20;
        if (rubrica.descricao.includes('40%') || rubrica.descricao.toLowerCase().includes('máximo')) rate = 0.40;
        
        if (rate > 0) {
            const unhealthyPay = minimumWage2024 * rate;
             return {
                provento: parseFloat(unhealthyPay.toFixed(2)),
                desconto: 0,
                referencia: rate * 100,
            }
        }
    }

    return null;
}
