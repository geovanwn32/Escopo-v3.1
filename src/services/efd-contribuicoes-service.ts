
import type { Company } from '@/types/company';
import { format } from 'date-fns';
import { startOfMonth, endOfMonth } from 'date-fns';

const formatValue = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0,00';
  return value.toFixed(2).replace('.', ',');
};

const formatDate = (date: Date): string => {
  return format(date, 'ddMMyyyy');
};

const sanitizeString = (str: string | undefined | null): string => {
    if (!str) return '';
    return str.replace(/\|/g, '').trim().toUpperCase();
}

interface ServiceResult {
    success: boolean;
    message?: string;
}

/**
 * Generates the EFD Contribuições TXT file content based on a specific layout.
 */
export async function generateEfdContribuicoesTxt(
    userId: string,
    company: Company,
    period: string,
    semMovimento: boolean
): Promise<ServiceResult> {
    const [monthStr, yearStr] = period.split('/');
    if (!monthStr || !yearStr || isNaN(parseInt(monthStr)) || isNaN(parseInt(yearStr))) {
        return { success: false, message: "Período inválido." };
    }
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    // Per a solicitação, o arquivo sempre será gerado como se não houvesse movimento
    const hasMovement = false; 

    const lines: string[] = [];
    const recordCounts: { [key: string]: number } = {};

    const addLine = (fields: (string | number | undefined)[]) => {
        const recordType = fields[0] as string;
        if (recordType) {
            recordCounts[recordType] = (recordCounts[recordType] || 0) + 1;
        }
        lines.push('|' + fields.map(f => (f === undefined || f === null) ? '' : f).join('|') + '|');
    };
    
    // Bloco 0: Abertura, Identificação e Referências
    addLine(['0000', '006', '0', '0', '', formatDate(startDate), formatDate(endDate), sanitizeString(company.razaoSocial), company.cnpj?.replace(/\D/g, ''), company.uf, '5201405', '', '00', '9']);
    addLine(['0001', '0']); // Sempre '0' (com dados) porque temos registros de abertura/encerramento
    addLine(['0110', '1', '1', '1', '']);
    addLine(['0120', format(startDate, 'MMyyyy'), '04']);
    addLine(['0140', '', sanitizeString(company.razaoSocial), company.cnpj?.replace(/\D/g, ''), company.inscricaoEstadual || '', '5201405', '', '']);
    addLine(['0990', Object.keys(recordCounts).length + 1]);

    // Blocos de Dados (sem movimento)
    addLine(['A001', '1']); addLine(['A990', '2']);
    addLine(['C001', '1']); addLine(['C990', '2']);
    addLine(['D001', '1']); addLine(['D990', '2']);
    addLine(['F001', '1']); addLine(['F990', '2']);
    addLine(['I001', '1']); addLine(['I990', '2']);
    
    // Bloco M (com movimento = 0, mas registros presentes)
    addLine(['M001', '0']);
    addLine(['M200', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0']);
    addLine(['M600', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0']);
    addLine(['M990', '4']);

    addLine(['P001', '1']); addLine(['P990', '2']);
    addLine(['1001', '1']); addLine(['1990', '2']);
    
    // Bloco 9: Encerramento do Arquivo Digital
    addLine(['9001', '0']);
    const finalRecordCounts: { [key: string]: number } = {...recordCounts};
    Object.keys(finalRecordCounts).forEach(record => {
        addLine(['9900', record, finalRecordCounts[record]]);
    });
    addLine(['9900', '9900', Object.keys(finalRecordCounts).length + 2]);
    addLine(['9900', '9999', 1]);
    addLine(['9990', lines.length + 2]);
    addLine(['9999', lines.length + 1]);

    // Ensure the last line ends with a CRLF
    const txtContent = lines.join('\r\n') + '\r\n';

    const blob = new Blob([txtContent], { type: 'text/plain;charset=iso-8859-1' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EFD_CONTRIBUICOES_${company.cnpj}_${monthStr}${yearStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { success: true };
}
