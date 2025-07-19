import type { TerminationResult } from "@/services/termination-service";
import type { FieldValue } from "firebase/firestore";

export interface Termination {
    id?: string;
    employeeId: string;
    employeeName: string;
    terminationDate: FieldValue | Date;
    reason: string;
    noticeType: string;
    fgtsBalance: number;
    result: TerminationResult;
    createdAt?: FieldValue | Date;
    updatedAt?: FieldValue;
}
