import type { FieldValue } from "firebase/firestore";

export interface Admission {
    id?: string;
    employeeId: string;
    employeeName: string;
    admissionDate: FieldValue | Date;
    cbo: string;
    naturezaAtividade: string;
    tipoRegimeTrabalhista: string;
    tipoRegimePrevidenciario: string;
    categoriaTrabalhador: string;
    createdAt?: FieldValue | Date;
    updatedAt?: FieldValue;
    esocialEventId?: string; // To link to the generated esocial event
}
