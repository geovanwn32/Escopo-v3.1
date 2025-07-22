
import { Timestamp } from "firebase/firestore";

export interface Dependent {
  nomeCompleto: string;
  dataNascimento: Date | Timestamp;
  cpf: string;
  isSalarioFamilia: boolean;
  isIRRF: boolean;
}

export interface Employee {
  id?: string;
  // Personal Data
  nomeCompleto: string;
  dataNascimento: Date;
  cpf: string;
  rg: string;
  estadoCivil: string;
  sexo: string;
  nomeMae: string;
  nomePai?: string;
  email?: string;
  telefone: string;
  dependentes: Dependent[];

  // Address
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;

  // Contract
  dataAdmissao: Date;
  cargo: string;
  departamento: string;
  salarioBase: number;
  tipoContrato: string;
  jornadaTrabalho: string;
  ativo: boolean;
}
