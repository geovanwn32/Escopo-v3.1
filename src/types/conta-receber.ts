
import type { FieldValue } from "firebase/firestore";

export type ContaReceberStatus = 'aberta' | 'paga' | 'vencida' | 'cancelada';

export interface ContaReceber {
    id?: string;
    description: string;
    partnerId: string;
    partnerName: string;
    issueDate: FieldValue | Date;
    dueDate: FieldValue | Date;
    value: number;
    status: ContaReceberStatus;
    createdAt?: FieldValue;
    updatedAt?: FieldValue;
}
