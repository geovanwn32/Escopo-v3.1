
export interface ContaContabil {
    id?: string;
    codigo: string;
    nome: string;
    descricao?: string;
    tipo: 'sintetica' | 'analitica';
    natureza: 'ativo' | 'passivo' | 'patrimonio_liquido' | 'receita' | 'despesa';
    parentId?: string | null;
}
