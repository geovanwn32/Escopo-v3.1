
import type { Rubrica } from './rubrica';
import type { FieldValue } from "firebase/firestore";

export interface PayrollEvent {
    id: string; 
    rubrica: Rubrica;
    referencia: number;
    provento: number;
    desconto: number;
}

export interface PayrollTotals {
    totalProventos: number;
    totalDescontos: number;
    liquido: number;
}

export interface Payroll {
    id?: string;
    employeeId: string;
    employeeName: string;
    period: string; // e.g., "07/2024"
    status: 'draft' | 'calculated' | 'finalized';
    events: PayrollEvent[];
    totals: PayrollTotals;
    baseINSS: number;
    baseIRRF: number;
    baseFGTS: number;
    fgtsValue: number;
    createdAt?: FieldValue | Date;
    updatedAt: FieldValue;
}
