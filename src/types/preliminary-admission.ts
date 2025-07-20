import type { FieldValue } from "firebase/firestore";

export interface PreliminaryAdmission {
    id?: string;
    employeeId: string;
    employeeName: string;
    admissionDate: FieldValue | Date;
    cpf: string;
    birthDate: FieldValue | Date;
    createdAt?: FieldValue | Date;
    updatedAt?: FieldValue;
    esocialEventId?: string; // To link to the generated esocial event
}
