
import type { FieldValue } from "firebase/firestore";

export interface OrcamentoItem {
  type: 'produto' | 'servico';
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  // Service-specific fields
  itemLc?: string;
  issAliquota?: number;
}

export interface Orcamento {
    id?: string;
    quoteNumber: number;
    partnerId: string;
    partnerName: string;
    items: OrcamentoItem[];
    total: number;
    createdAt?: FieldValue | Date;
    updatedAt?: FieldValue;
}
