
import type { RciEvent, RciTotals } from "@/app/(app)/pessoal/rci/page";
import type { FieldValue } from "firebase/firestore";

export interface RCI {
    id?: string;
    socioId: string;
    socioName: string;
    period: string; // e.g., "07/2024"
    status: 'draft' | 'calculated' | 'finalized';
    events: RciEvent[];
    totals: RciTotals;
    baseINSS: number;
    baseIRRF: number;
    createdAt?: FieldValue | Date;
    updatedAt: FieldValue;
}
