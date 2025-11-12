
export interface Produto {
    id?: string;
    codigo: string;
    descricao: string;
    ncm: string;
    cst?: string;
    cfop: string;
    valorUnitario: number;
    baseCalculoIcms?: number;
    valorIcms?: number;
    valorIpi?: number;
    aliqIcms?: number;
    aliqIpi?: number;
}
