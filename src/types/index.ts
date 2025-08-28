
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
export type { Payroll } from './payroll';
export type { Pgdas, SimplesAnnexType } from './pgdas';
export type { PreliminaryAdmission } from './preliminary-admission';
export type { Produto } from './produto';
export type { RCI } from './rci';
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

export type ReinfEventType = 'R-1000' | 'R-1070' | 'R-2010' | 'R-2020' | 'R-2099'; // Add other event types as needed
export type ReinfEventStatus = 'pending' | 'success' | 'error';

export interface ReinfFile {
  id?: string;
  fileName: string;
  period: string;
  type: ReinfEventType;
  status: ReinfEventStatus; // Add status for more detailed dashboard
  createdAt: FieldValue | Date;
  userId: string;
  companyId: string;
}


export interface Launch {
    id: string;
    fileName: string;
    type: string;
    status: 'Normal' | 'Cancelado' | 'Substituida';
    date: Date;
    chaveNfe?: string;
    numeroNfse?: string;
    financialStatus?: 'pendente' | 'pago' | 'vencido';
    observacoes?: string | null;
    
    // NFS-e fields
    prestador?: { nome: string; cnpj: string; };
    tomador?: { nome: string; cnpj: string; };
    discriminacao?: string;
    itemLc116?: string;
    valorServicos?: number;
    valorLiquido?: number;
    valorPis?: number;
    valorCofins?: number;
    valorIr?: number;
    valorInss?: number;
    valorCsll?: number;
    valorIss?: number;


    // NF-e fields
    emitente?: { nome: string; cnpj: string; };
    destinatario?: { nome: string; cnpj: string; };
    valorProdutos?: number;
    valorTotalNota?: number;
    valorIpi?: number;
    valorIcms?: number;
    produtos?: {
      codigo?: string;
      descricao?: string;
      ncm?: string;
      cfop?: string;
      quantidade: number;
      valorUnitario: number;
      valorTotal: number;
    }[];
}
