
import type { FieldValue } from "firebase/firestore";

export interface Partida {
    contaId: string;
    tipo: 'debito' | 'credito';
    valor: number;
}

export interface LancamentoContabil {
    id?: string;
    data: FieldValue | Date;
    descricao: string;
    partidas: Partida[];
    valorTotal: number;
    createdAt?: FieldValue;
    updatedAt?: FieldValue;
}
