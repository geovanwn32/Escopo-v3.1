import type { FieldValue } from "firebase/firestore";

export interface Recibo {
    id?: string;
    numero: string;
    valor: number;
    pagadorNome: string; // "Recebi(emos) de"
    pagadorEndereco?: string;
    importanciaExtenso: string;
    referente: string;
    data: FieldValue | Date;
    emitenteId: string; // Could be a Partner or Employee ID
    emitenteNome: string;
    emitenteCpfCnpj: string;
    emitenteEndereco?: string;
    createdAt?: FieldValue;
    updatedAt?: FieldValue;
}
