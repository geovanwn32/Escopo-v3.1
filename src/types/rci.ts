

import type { Rubrica } from './rubrica';
import type { FieldValue } from "firebase/firestore";

export interface RciEvent {
    id: string; 
    rubrica: Rubrica;
    referencia: number;
    provento: number;
    desconto: number;
}

export interface RciTotals {
    totalProventos: number;
    totalDescontos: number;
    liquido: number;
}


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
