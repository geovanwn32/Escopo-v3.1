
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
  dependentesIRRF: number;
  dependentesSalarioFamilia: number;

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
