
export interface Rubrica {
    id?: string;
    codigo: string;
    descricao: string;
    tipo: 'provento' | 'desconto';
    incideINSS: boolean;
    incideFGTS: boolean;
    incideIRRF: boolean;
}
