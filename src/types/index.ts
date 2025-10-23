
export type { Aliquota, EsferaTributaria } from './aliquota';
export type { BankTransaction } from './bank-transaction';
export type { Company, EstablishmentData } from './company';
export type { ContaContabil } from './conta-contabil';
export type { ContaReceber } from './conta-receber';
export type { ContractData } from './contract';
export type { Employee, Dependent } from './employee';
export type { EsocialEvent, EsocialEventStatus, EsocialEventType } from './esocial';
export type { CalendarEvent } from './event';
export type { StoredFile } from './file';
export type { LancamentoContabil, Partida } from './lancamento-contabil';
export type { Orcamento, OrcamentoItem } from './orcamento';
export type { Partner, PartnerType } from './partner';
export type { Payroll, PayrollEvent, PayrollTotals } from './payroll';
export type { Pgdas, SimplesAnnexType } from './pgdas';
export type { PreliminaryAdmission } from './preliminary-admission';
export type { Produto } from './produto';
export type { Recibo } from './recibo';
export type { RCI, RciEvent, RciTotals } from './rci';
export type { ReinfFile } from './reinf';
export type { Rubrica } from './rubrica';
export type { Servico } from './servico';
export type { Socio } from './socio';
export type { Termination } from './termination';
export type { Thirteenth } from './thirteenth';
export type { Ticket, TicketStatus } from './ticket';
export type { AppUser } from './user';
export type { Vacation } from './vacation';
import type { FieldValue } from 'firebase/firestore';


export interface XmlFile {
  file: {
    name: string;
    type: string;
    size: number;
    lastModified: number;
  };
  content: string;
  status: 'pending' | 'launched' | 'error' | 'cancelled';
  type: 'entrada' | 'saida' | 'servico' | 'desconhecido' | 'cancelamento';
  key?: string; // NFe key or NFS-e unique identifier
  versaoNfse?: string;
}

export interface EfdFile {
  id?: string;
  fileName: string;
  period: string;
  type: '0' | '1'; // 0-Original, 1-Retificadora
  isSemMovimento: boolean;
  createdAt: FieldValue | Date;
  userId: string;
  companyId: string;
}

export interface Launch {
    id: string;
    fileName: string;
    type: 'entrada' | 'saida' | 'servico';
    status: 'Normal' | 'Cancelado' | 'Substituida';
    date: Date;
    chaveNfe?: string | null;
    numeroNfse?: string | null;
    serie?: string | null;
    codigoVerificacaoNfse?: string;
    versaoNfse?: string;
    financialStatus?: 'pendente' | 'pago' | 'vencido';
    observacoes?: string | null;
    
    // Parties
    emitente?: { nome: string; cnpj: string; } | null;
    destinatario?: { nome: string; cnpj: string; } | null;
    prestador?: { nome: string; cnpj: string; } | null;
    tomador?: { nome: string; cnpj: string; } | null;
    
    // NFS-e specific
    discriminacao?: string | null;
    itemLc116?: string | null;
    valorServicos?: number | null;
    
    // NF-e specific
    valorProdutos?: number | null;
    valorTotalNota?: number | null;
    modalidadeFrete?: string | null;

    // Taxes
    valorPis?: number | null;
    valorCofins?: number | null;
    valorIr?: number | null;
    valorInss?: number | null;
    valorCsll?: number | null;
    valorIss?: number | null;
    valorIpi?: number | null;
    valorIcms?: number | null;
    valorLiquido?: number | null;

    produtos?: {
      codigo?: string | null;
      descricao: string;
      ncm?: string | null;
      cfop?: string | null;
      unidade?: string | null;
      quantidade: number;
      valorUnitario: number;
      valorTotal: number;
      baseCalculo?: number | null;
      vlrIcms?: number | null;
      vlrIpi?: number | null;
      aliqIcms?: number | null;
      aliqIpi?: number | null;
    }[];
}
