export type PartnerType = 'cliente' | 'fornecedor' | 'transportadora';

export interface Partner {
  id?: string;
  type: PartnerType;
  tipoPessoa: 'pf' | 'pj';
  // Identity
  nomeFantasia: string;
  razaoSocial: string;
  cpfCnpj: string;
  inscricaoEstadual?: string;
  regimeTributario?: string;

  // Address
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;

  // Contact
  email?: string;
  telefone?: string;
}
