
import type { ThirteenthResult } from "@/services/thirteenth-salary-service";
import type { FieldValue } from "firebase/firestore";

export interface Thirteenth {
    id?: string;
    employeeId: string;
    employeeName: string;
    year: number;
    parcel: 'first' | 'second' | 'unique';
    result: ThirteenthResult;
    createdAt?: FieldValue | Date;
    updatedAt?: FieldValue;
}
