
export type EsferaTributaria = 'municipal' | 'estadual' | 'federal';

export interface Aliquota {
    id?: string;
    esfera: EsferaTributaria;
    nomeDoImposto: string; // Ex: ICMS, PIS, ISS
    descricao: string; // Ex: Alíquota interna, Alíquota de importação, ISS Goiânia
    aliquota: number; // Percentual
    itemLc?: string; // Código do item da Lista de Serviços (LC 116)
}
