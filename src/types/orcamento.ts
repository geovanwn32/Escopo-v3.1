
import type { FieldValue } from "firebase/firestore";

export interface OrcamentoItem {
  type: 'produto' | 'servico';
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Orcamento {
    id?: string;
    partnerId: string;
    partnerName: string;
    items: OrcamentoItem[];
    total: number;
    createdAt?: FieldValue | Date;
    updatedAt?: FieldValue;
}
