export type PartnerType = 'cliente' | 'fornecedor' | 'transportadora';

export interface Partner {
  id?: string;
  type: PartnerType;
  // Identity
  nomeFantasia: string;
  razaoSocial: string;
  cpfCnpj: string;
  inscricaoEstadual?: string;

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
