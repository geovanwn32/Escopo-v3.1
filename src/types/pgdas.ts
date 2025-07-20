
import type { PGDASResult } from "@/services/pgdas-report-service";
import type { FieldValue } from "firebase/firestore";

export interface Pgdas {
    id?: string;
    period: string;
    result: PGDASResult;
    createdAt: FieldValue;
}
