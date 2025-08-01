
import type { Company } from '@/types/company';
import { format, startOfMonth, endOfMonth } from 'date-fns';

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
    
    // Conforme o exemplo, o arquivo é sempre gerado como se não houvesse movimento nos blocos de dados.
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
    
    // --- BLOCO 0 ---
    addLine(['0000', '006', '0', '0', '', formatDate(startDate), formatDate(endDate), sanitizeString(company.razaoSocial), company.cnpj?.replace(/\D/g, ''), company.uf, '5201405', '', '00', '9']);
    addLine(['0001', hasMovement ? '0' : '1']);
    addLine(['0110', '1', '1', '1', '']);
    addLine(['0120', format(startDate, 'MMyyyy'), '04']);
    // Registro 0140: 9 campos no total
    addLine(['0140', '', sanitizeString(company.razaoSocial), company.cnpj?.replace(/\D/g, ''), company.uf || '', company.inscricaoEstadual || '', '5201405', company.inscricaoMunicipal || '', '']);
    addLine(['0990', Object.keys(recordCounts).length + 1]);

    // --- BLOCOS DE DADOS (SEM MOVIMENTO) ---
    addLine(['A001', '1']); addLine(['A990', '2']);
    addLine(['C001', '1']); addLine(['C990', '2']);
    addLine(['D001', '1']); addLine(['D990', '2']);
    addLine(['F001', '1']); addLine(['F990', '2']);
    addLine(['I001', '1']); addLine(['I990', '2']);
    
    // --- BLOCO M ---
    addLine(['M001', '0']);
    addLine(['M200', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00']);
    addLine(['M600', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00', '0,00']);
    addLine(['M990', '4']);

    // --- OUTROS BLOCOS (SEM MOVIMENTO) ---
    addLine(['P001', '1']); addLine(['P990', '2']);
    addLine(['1001', '1']); addLine(['1990', '2']);
    
    // --- BLOCO 9: ENCERRAMENTO ---
    addLine(['9001', '0']);
    
    // Temporarily store all generated lines to count records for block 9
    const allGeneratedLines = [...lines];

    // Count records again for block 9, based on what was actually added
    const finalRecordCounts: { [key: string]: number } = {};
    allGeneratedLines.forEach(line => {
        const recordType = line.split('|')[1];
        if (recordType) {
            finalRecordCounts[recordType] = (finalRecordCounts[recordType] || 0) + 1;
        }
    });
     finalRecordCounts['9001'] = 1;

    const block9Lines: string[] = [];
    Object.keys(finalRecordCounts).sort().forEach(record => {
        block9Lines.push(`|9900|${record}|${finalRecordCounts[record]}|`);
    });
    
    // Add count for 9900 itself, plus the upcoming 9990 and 9999
    block9Lines.push(`|9900|9900|${block9Lines.length + 3}|`);
    block9Lines.push(`|9900|9990|1|`);
    block9Lines.push(`|9900|9999|1|`);

    const finalLines = [...allGeneratedLines, ...block9Lines];
    
    // Now add the final totalizers
    finalLines.push(`|9990|${block9Lines.length + 1}|`);
    finalLines.push(`|9999|${finalLines.length + 1}|`);

    const txtContent = finalLines.join('\r\n') + '\r\n';

    const blob = new Blob([txtContent], { type: 'text/plain;charset=iso-8859-1' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EFD_CONTRIBUICOES_${company.cnpj?.replace(/\D/g, '')}_${monthStr}${yearStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { success: true };
}
