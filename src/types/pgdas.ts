
import type { PGDASResult } from "@/services/pgdas-report-service";
import type { FieldValue } from "firebase/firestore";

export interface Pgdas {
    id?: string;
    period: string;
    anexo: 'anexo-i' | 'anexo-iii'; // Expand as more annexes are supported
    result: PGDASResult;
    createdAt: FieldValue;
}
