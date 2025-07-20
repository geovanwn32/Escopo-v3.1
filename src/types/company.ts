

export interface EstablishmentData {
    aliqRat: number;
    fap: number;
    contrataPCD: boolean;
    nrInscApr: string;
    nrCaepf?: string;
}

export interface Company {
    id: string;
    nomeFantasia: string;
    razaoSocial: string;
    cnpj: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
    cnaePrincipalCodigo?: string;
    establishment?: EstablishmentData;
}
