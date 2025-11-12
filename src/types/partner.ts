
export type PartnerType = 'cliente' | 'fornecedor' | 'transportadora';
export type TipoContribuinteIcms = '1_contribuinte' | '2_contribuinte_isento' | '9_nao_contribuinte';
export type RegimeTributario = 'simples' | 'presumido' | 'real' | 'mei';

export interface Partner {
  id?: string;
  type: PartnerType;
  tipoPessoa: 'pf' | 'pj';
  // Identity
  nomeFantasia: string;
  razaoSocial: string;
  cpfCnpj: string;
  inscricaoEstadual?: string;
  regimeTributario?: RegimeTributario;
  contribuinteIcms?: TipoContribuinteIcms;

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
