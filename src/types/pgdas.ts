
import type { PGDASResult } from "@/services/pgdas-report-service";
import type { FieldValue } from "firebase/firestore";

export type SimplesAnnexType = 'anexo-i' | 'anexo-ii' | 'anexo-iii' | 'anexo-iv' | 'anexo-v';

export interface Pgdas {
    id?: string;
    period: string;
    anexo: SimplesAnnexType;
    result: PGDASResult;
    createdAt?: FieldValue | Date;
}
