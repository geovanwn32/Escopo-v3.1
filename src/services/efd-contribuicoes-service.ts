
import type { Company } from '@/types/company';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Launch } from '@/app/(app)/fiscal/page';

const formatValue = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0,00';
  return value.toFixed(2).replace('.', ',');
};

const formatDate = (date: Date): string => {
  return format(date, 'ddMMyyyy');
};

const sanitizeString = (str: string | undefined | null): string => {
    if (!str) return '';
    return str.replace(/[|]/g, '').trim().toUpperCase();
}

interface ServiceResult {
    success: boolean;
    message?: string;
}

/**
 * Generates the EFD Contribuições TXT file content based on a specific layout.
 * This version handles data fetching for a full file generation.
 */
export async function generateEfdContribuicoesTxt(
    userId: string,
    company: Company,
    period: string,
    semMovimento: boolean,
    tipoEscrituracao: '0' | '1' = '0'
): Promise<ServiceResult> {
    const [monthStr, yearStr] = period.split('/');
    if (!monthStr || !yearStr) {
        return { success: false, message: "Período inválido." };
    }
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    let launches: Launch[] = [];
    if (!semMovimento) {
        const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
        const q = query(launchesRef, 
            where('date', '>=', Timestamp.fromDate(startDate)),
            where('date', '<=', Timestamp.fromDate(endDate))
        );
        const snapshot = await getDocs(q);
        launches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Launch));
    }
    
    if (!semMovimento && launches.length === 0) {
        return { success: false, message: "Nenhum lançamento fiscal encontrado no período para gerar o arquivo com movimento." };
    }

    const lines: string[] = [];
    const addLine = (fields: (string | number | undefined)[]) => {
        lines.push('|' + fields.map(f => (f === undefined || f === null) ? '' : f).join('|') + '|');
    };

    // --- BLOCO 0 ---
    const bloco0Lines: string[] = [];
    const addLine0 = (fields: any[]) => bloco0Lines.push('|' + fields.join('|') + '|');
    
    addLine0(['0000', '006', tipoEscrituracao, '0', '', formatDate(startDate), formatDate(endDate), sanitizeString(company.razaoSocial), company.cnpj?.replace(/\D/g, ''), company.uf, '5201405', company.inscricaoMunicipal || '', '00', company.incidenciaTributaria || '1']);
    addLine0(['0001', '0']); // Com dados
    addLine0(['0110', company.apuracaoPisCofins || '1', company.metodoApropriacaoCredito || '1', '1', '']);
    addLine0(['0120', format(startDate, 'MMyyyy'), '04']);
    addLine0(['0140', '', sanitizeString(company.razaoSocial), company.cnpj?.replace(/\D/g, ''), company.uf, company.inscricaoEstadual || '', '5201405', '', '']);
    
    lines.push(...bloco0Lines);
    addLine(['0990', bloco0Lines.length + 1]); // Encerramento Bloco 0

    // --- BLOCO A ---
    const servicos = launches.filter(l => l.type === 'servico');
    const blocoALines: string[] = [];
    const addLineA = (fields: any[]) => blocoALines.push('|' + fields.join('|') + '|');
    addLineA(['A001', servicos.length > 0 ? '0' : '1']);
    if (servicos.length > 0) {
        servicos.forEach(s => {
            const tomadorCnpj = s.tomador?.cnpj?.replace(/\D/g, '') || '';
            addLineA(['A010', tomadorCnpj]);
            addLineA([
                'A100', '2', s.status === 'Cancelado' ? '02' : '01', s.numeroNfse, s.chaveNfe, formatDate(s.date as Date), formatDate(s.date as Date),
                formatValue(s.valorServicos), '0', '0', '0', '0', formatValue(s.valorLiquido)
            ]);
        });
    }
    lines.push(...blocoALines);
    addLine(['A990', blocoALines.length + 1]);

    // --- BLOCO C ---
    const produtos = launches.filter(l => l.type === 'saida');
    const blocoCLines: string[] = [];
    const addLineC = (fields: any[]) => blocoCLines.push('|' + fields.join('|') + '|');
    addLineC(['C001', produtos.length > 0 ? '0' : '1']);
    if (produtos.length > 0) {
        produtos.forEach(p => {
             const destCnpj = p.destinatario?.cnpj?.replace(/\D/g, '') || '';
             addLineC(['C010', destCnpj]);
             addLineC([
                'C100', '1', '1', destCnpj, '55', p.status === 'Cancelado' ? '02' : '01', '', p.chaveNfe, 
                formatDate(p.date as Date), formatDate(p.date as Date), formatValue(p.valorTotalNota), '1', 
                '0', '0', formatValue(p.valorTotalNota), '9', formatValue(p.valorTotalNota), '0', '0', '0'
             ]);
        });
    }
    lines.push(...blocoCLines);
    addLine(['C990', blocoCLines.length + 1]);
    
    // --- BLOCO D (Placeholder) ---
    addLine(['D001', '1']);
    addLine(['D990', 2]);

    // --- BLOCO F (Placeholder) ---
    addLine(['F001', '1']);
    addLine(['F990', 2]);
    
    // --- BLOCO I (Placeholder) ---
    addLine(['I001', '1']);
    addLine(['I990', 2]);

    // --- BLOCO M ---
    const totalPis = launches.reduce((acc, l) => acc + (l.valorPis || 0), 0);
    const totalCofins = launches.reduce((acc, l) => acc + (l.valorCofins || 0), 0);
    const hasPisCofins = totalPis > 0 || totalCofins > 0;
    
    const blocoMLines: string[] = [];
    const addLineM = (fields: any[]) => blocoMLines.push('|' + fields.join('|') + '|');
    
    addLineM(['M001', hasPisCofins ? '0' : '1']);
    if(hasPisCofins) {
        addLineM(['M200', formatValue(totalPis), '0', '0', '0', formatValue(totalPis), '01']);
        addLineM(['M600', formatValue(totalCofins), '0', '0', '0', formatValue(totalCofins), '01']);
    }
    lines.push(...blocoMLines);
    addLine(['M990', blocoMLines.length + 1]);


    // --- BLOCO P (Placeholder) ---
    addLine(['P001', '1']);
    addLine(['P990', 2]);

    // --- BLOCO 1 (Placeholder) ---
    addLine(['1001', '1']);
    addLine(['1990', 2]);

    // --- BLOCO 9: ENCERRAMENTO ---
    const recordCounts: { [key: string]: number } = {};
    lines.forEach(line => {
        const recordType = line.split('|')[1];
        if (recordType) {
            recordCounts[recordType] = (recordCounts[recordType] || 0) + 1;
        }
    });

    const bloco9Lines: string[] = [];
    const addLine9 = (fields: any[]) => bloco9Lines.push('|' + fields.join('|') + '|');
    
    addLine9(['9001', '0']);
    
    const finalCounts = { ...recordCounts };
    finalCounts['9001'] = 1;
    
    Object.keys(finalCounts).sort().forEach(record => {
        bloco9Lines.push(`|9900|${record}|${finalCounts[record]}|`);
    });
    
    const countOf9900Records = Object.keys(finalCounts).length;
    bloco9Lines.push(`|9900|9900|${countOf9900Records + 3}|`); // +3 for 9900, 9990, 9999
    bloco9Lines.push(`|9900|9990|1|`);
    bloco9Lines.push(`|9900|9999|1|`);
    
    const totalLinesInBlock9 = bloco9Lines.length + 1; // +1 for 9990 itself
    bloco9Lines.push(`|9990|${totalLinesInBlock9}|`);
    
    const totalLinesInFile = lines.length + totalLinesInBlock9 + 1; // +1 for 9999
    bloco9Lines.push(`|9999|${totalLinesInFile}|`);

    const finalFileContent = [...lines, ...bloco9Lines].join('\r\n') + '\r\n';

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
