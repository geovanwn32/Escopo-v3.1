
export interface Rubrica {
    id?: string;
    codigo: string;
    descricao: string;
    tipo: 'provento' | 'desconto';
    naturezaESocial: string;
    incideINSS: boolean;
    incideFGTS: boolean;
    incideIRRF: boolean;
}
