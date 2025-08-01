
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
    // Remove o caractere pipe e quaisquer outros caracteres que possam quebrar o leiaute.
    return str.replace(/[|]/g, '').trim().toUpperCase();
}

interface ServiceResult {
    success: boolean;
    message?: string;
}

/**
 * Generates the EFD Contribuições TXT file content based on a specific layout.
 * This version uses a more robust method for calculating the final record counts (Block 9).
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

    // Use a safe method to calculate start and end dates
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
    // Field 2 (COD_EST) is optional and is being left empty as per standard practice. The pipe delimiters handle the positioning.
    addLine(['0140', '', sanitizeString(company.razaoSocial), company.cnpj?.replace(/\D/g, ''), company.uf || '', '', cityCode, '', '']);
    addLine(['0990', lines.length + 1]);

    // --- BLOCOS DE DADOS (SEM MOVIMENTO) ---
    addLine(['A001', '1']); addLine(['A990', '2']);
    addLine(['C001', '1']); addLine(['C990', '2']);
    addLine(['D001', '1']); addLine(['D990', '2']);
    addLine(['F001', '1']); addLine(['F990', '2']);
    addLine(['I001', '1']); addLine(['I990', '2']);
    
    // --- BLOCO M ---
    addLine(['M001', '1']); // Bloco sem movimento
    addLine(['M990', '2']);

    // --- OUTROS BLOCOS (SEM MOVIMENTO) ---
    addLine(['P001', '1']); addLine(['P990', '2']);
    addLine(['1001', '1']); addLine(['1990', '2']);
    
    // --- BLOCO 9: ENCERRAMENTO ---
    
    // Start Block 9
    const block9Lines: string[] = [];
    block9Lines.push('|9001|0|'); // 0 = Bloco 9 com dados

    // Count all records generated so far (data blocks)
    const recordCounts: { [key: string]: number } = {};
    lines.forEach(line => {
        const recordType = line.split('|')[1];
        if (recordType) {
            recordCounts[recordType] = (recordCounts[recordType] || 0) + 1;
        }
    });

    // Add count for the Block 9 opener itself
    recordCounts['9001'] = 1;

    // Generate 9900 records for each type
    Object.keys(recordCounts).sort().forEach(record => {
        block9Lines.push(`|9900|${record}|${recordCounts[record]}|`);
    });

    // Add count for the 9900 records we are about to add
    // The +3 is for 9900, 9990, and 9999 which are also part of Block 9.
    const countOf9900Records = Object.keys(recordCounts).length;
    block9Lines.push(`|9900|9900|${countOf9900Records + 3}|`);

    // Add count for 9990 and 9999
    block9Lines.push('|9900|9990|1|');
    block9Lines.push('|9900|9999|1|');
    
    // Now that all 9900 records are generated, we can finalize the totals for 9990 and 9999
    // QTD_LIN_9: Total lines in Block 9. It's the sum of all `9900` lines + the `9001`, `9990`, and `9999` lines themselves.
    const totalLinesInBlock9 = block9Lines.length + 2; // +2 for the 9990 and 9999 lines that will be added.
    block9Lines.push(`|9990|${totalLinesInBlock9}|`);
    
    // QTD_LIN: Total lines in the file.
    const totalLinesInFile = lines.length + totalLinesInBlock9;
    block9Lines.push(`|9999|${totalLinesInFile}|`);

    const finalFileContent = [...lines, ...block9Lines].join('\r\n') + '\r\n';

    const blob = new Blob([finalFileContent], { type: 'text/plain;charset=iso-8859-1' });
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
