
import type { FieldValue } from "firebase/firestore";

export interface Recibo {
    id?: string;
    tipo: 'Recibo' | 'Comprovante';
    natureza: 'despesa' | 'receita';
    numero: number;
    valor: number;
    pagadorNome: string; // "Recebi(emos) de" ou "Pagamos a"
    pagadorEndereco?: string;
    valorPorExtenso: string;
    referenteA: string;
    data: FieldValue | Date;
    emitenteId: string;
    emitenteNome: string;
    emitenteEndereco?: string;
    createdAt?: FieldValue | Date;
    updatedAt?: FieldValue | Date;
}
