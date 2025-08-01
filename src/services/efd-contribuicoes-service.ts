
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

    const lines: string[] = [];

    const addLine = (fields: (string | number | undefined)[]) => {
        lines.push('|' + fields.map(f => (f === undefined || f === null) ? '' : f).join('|') + '|');
    };
    
    // Hardcoded IBGE code for Aparecida de Goiânia as per the error log
    const cityCode = '5201405';

    // --- BLOCO 0 ---
    addLine(['0000', '006', '0', '0', '', formatDate(startDate), formatDate(endDate), sanitizeString(company.razaoSocial), company.cnpj?.replace(/\D/g, ''), company.uf, cityCode, '', '00', '9']);
    addLine(['0001', '0']); // 0 = Bloco com dados informados
    addLine(['0110', '1', '1', '1', '']);
    addLine(['0120', format(startDate, 'MMyyyy'), '04']);
    addLine(['0140', '', sanitizeString(company.razaoSocial), company.cnpj?.replace(/\D/g, ''), company.uf || '', '', cityCode, '', '']);
    addLine(['0990', lines.length + 1]);

    // --- BLOCOS DE DADOS (SEM MOVIMENTO) ---
    addLine(['A001', '1']); addLine(['A990', '2']);
    addLine(['C001', '1']); addLine(['C990', '2']);
    addLine(['D001', '1']); addLine(['D990', '2']);
    addLine(['F001', '1']); addLine(['F990', '2']);
    addLine(['I001', '1']); addLine(['I990', '2']);
    
    // --- BLOCO M ---
    addLine(['M001', '0']);
    addLine(['M200', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0']);
    addLine(['M600', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0']);
    addLine(['M990', '4']);

    // --- OUTROS BLOCOS (SEM MOVIMENTO) ---
    addLine(['P001', '1']); addLine(['P990', '2']);
    addLine(['1001', '1']); addLine(['1990', '2']);
    
    // --- BLOCO 9: ENCERRAMENTO ---
    addLine(['9001', '0']);
    
    // Final count logic
    const recordCounts: { [key: string]: number } = {};
    lines.forEach(line => {
        const recordType = line.split('|')[1];
        if (recordType) {
            recordCounts[recordType] = (recordCounts[recordType] || 0) + 1;
        }
    });

    const block9Lines: string[] = [];
    Object.keys(recordCounts).sort().forEach(record => {
        block9Lines.push(`|9900|${record}|${recordCounts[record]}|`);
    });
    
    const countOf9900 = block9Lines.length;
    
    // Add the counters for the Block 9 records themselves
    block9Lines.push(`|9900|9900|${countOf9900 + 3}|`); // Counts itself, 9990, and 9999
    block9Lines.push(`|9900|9990|1|`);
    block9Lines.push(`|9900|9999|1|`);
    
    const allLinesWith9900 = [...lines, ...block9Lines];
    
    const totalLinesInBlock9 = block9Lines.length + 1; // +1 for the 9001 record
    allLinesWith9900.push(`|9990|${totalLinesInBlock9}|`);
    
    const totalLinesInFile = allLinesWith9900.length + 1; // +1 for the 9999 record itself
    allLinesWith9900.push(`|9999|${totalLinesInFile}|`);

    const txtContent = allLinesWith9900.join('\r\n') + '\r\n';

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
