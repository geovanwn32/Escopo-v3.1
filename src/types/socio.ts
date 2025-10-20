
export interface Socio {
  id?: string;
  // Personal Data
  nomeCompleto: string;
  dataNascimento: Date;
  cpf: string;
  rg: string;
  nis?: string; // NIT/PIS
  estadoCivil: string;
  nacionalidade: string;
  profissao: string;
  
  // Address
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  
  // Contact
  email?: string;
  telefone: string;

  // Corporate Data
  dataEntrada: Date;
  participacao: number;
  proLabore: number;
  isAdministrador: boolean;
}
