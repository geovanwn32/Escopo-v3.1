import type { PayrollEvent, PayrollTotals } from "@/app/(app)/pessoal/folha-de-pagamento/page";
import type { FieldValue } from "firebase/firestore";

export interface Payroll {
    id?: string;
    employeeId: string;
    employeeName: string;
    period: string; // e.g., "07/2024"
    status: 'draft' | 'calculated' | 'finalized';
    events: PayrollEvent[];
    totals: PayrollTotals;
    baseINSS?: number;
    baseIRRF?: number;
    baseFGTS?: number;
    fgtsValue?: number;
    createdAt?: FieldValue | Date;
    updatedAt: FieldValue;
}
