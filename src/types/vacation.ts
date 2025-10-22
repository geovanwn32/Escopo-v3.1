

import type { VacationResult } from "@/services/vacation-service";
import type { FieldValue } from "firebase/firestore";

export interface Vacation {
    id?: string;
    employeeId: string;
    employeeName: string;
    startDate: FieldValue | Date;
    vacationDays: number;
    sellVacation: boolean;
    advanceThirteenth: boolean;
    result: VacationResult;
    createdAt?: FieldValue | Date;
    updatedAt?: FieldValue;
}
