import type { Employee } from "@/types/employee";
import type { Rubrica } from "@/types/rubrica";
import type { PayrollEvent } from "@/app/(app)/pessoal/folha-de-pagamento/page";

// --- Tabela Salário Família 2024 ---
const familyAllowanceBracket = {
    limit: 1819.26,
    valuePerDependent: 62.04
};

// --- Salário Mínimo 2024 ---
const minimumWage2024 = 1412.00;

interface CalculatedEvent {
    referencia: number;
    provento: number;
    desconto: number;
}

/**
 * Calculates the value for specific, automatic payroll events based on Brazilian law.
 * @param rubrica The event's rubrica to be calculated.
 * @param employee The employee for whom the payroll is being calculated.
 * @param allEvents The list of all other events already in the payroll.
 * @param reference Manually entered reference value (e.g., hours).
 * @returns An object with calculated values or null if the event is not automatic.
 */
export function calculateAutomaticEvent(
    rubrica: Rubrica,
    employee: Employee,
    allEvents: PayrollEvent[],
    reference?: number
): Partial<CalculatedEvent> | null {

    const baseSalary = employee.salarioBase;

    // --- Salário Família ---
    if (rubrica.codigo === '0005') { // Assuming '0005' is Salário Família
        const totalProventos = allEvents.filter(e => e.rubrica.incideINSS).reduce((acc, e) => acc + e.provento, 0);
        
        if (totalProventos <= familyAllowanceBracket.limit && employee.dependentes > 0) {
            return {
                referencia: employee.dependentes,
                provento: employee.dependentes * familyAllowanceBracket.valuePerDependent,
                desconto: 0,
            };
        }
        return { referencia: 0, provento: 0, desconto: 0 }; // Does not qualify
    }

    // --- Vale-Transporte ---
    if (rubrica.codigo === '0004') { // Assuming '0004' is Vale-Transporte
        const discount = baseSalary * 0.06;
        return {
            referencia: 6, // 6%
            provento: 0,
            desconto: discount,
        };
    }

    // --- Horas Extras 50% ---
    if (rubrica.descricao.toLowerCase().includes('horas extras 50%')) {
        const hourlyRate = baseSalary / 220;
        const overtimePay = hourlyRate * 1.5 * (reference || 0);
        return {
            provento: parseFloat(overtimePay.toFixed(2)),
            desconto: 0,
            referencia: reference || 0,
        }
    }
    
    // --- Adicional Noturno (20%) ---
    if (rubrica.descricao.toLowerCase().includes('adicional noturno')) {
        const hourlyRate = baseSalary / 220;
        const nightShiftPremium = hourlyRate * 0.20 * (reference || 0);
        return {
            provento: parseFloat(nightShiftPremium.toFixed(2)),
            desconto: 0,
            referencia: reference || 0,
        }
    }
    
    // --- Periculosidade (30%) ---
    if (rubrica.descricao.toLowerCase().includes('periculosidade')) {
        const hazardPay = baseSalary * 0.30;
        return {
            provento: parseFloat(hazardPay.toFixed(2)),
            desconto: 0,
            referencia: 30, // 30%
        }
    }
    
    // --- Insalubridade (10%, 20%, 40% on Minimum Wage) ---
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
                referencia: rate * 100, // 10, 20 or 40
            }
        }
    }

    // Return null if no automatic calculation rule matches
    return null;
}
