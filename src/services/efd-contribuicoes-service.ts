
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Launch } from '@/app/(app)/fiscal/page';
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
    // Remove unsupported characters and limit length if necessary.
    // This is a basic sanitization, a more robust one might be needed.
    return str.replace(/\|/g, '').trim();
}

interface ServiceResult {
    success: boolean;
    message?: string;
}

/**
 * Generates the EFD Contribuições TXT file content.
 */
export async function generateEfdContribuicoesTxt(userId: string, company: Company, period: string): Promise<ServiceResult> {
    const [monthStr, yearStr] = period.split('/');
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    // --- 1. FETCH DATA ---
    const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
    const q = query(launchesRef,
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
    );
    const snapshot = await getDocs(q);
    const launches = snapshot.docs.map(doc => doc.data() as Launch);

    const salesLaunches = launches.filter(l => l.type === 'saida');
    const serviceLaunches = launches.filter(l => l.type === 'servico');

    if (salesLaunches.length === 0 && serviceLaunches.length === 0) {
        return { success: false, message: "Nenhuma nota de saída ou serviço encontrada para o período selecionado." };
    }

    // --- 2. BUILD TXT CONTENT ---
    let txtContent = '';
    const EOL = '\r\n'; // End of Line for the file

    // Helper to add a line
    const addLine = (fields: (string | number | undefined)[]) => {
        txtContent += '|' + fields.map(f => (f === undefined || f === null) ? '' : f).join('|') + '|' + EOL;
    };

    // Bloco 0: Abertura, Identificação e Referências
    addLine(['0000', '018', '2', formatDate(startDate), formatDate(endDate), sanitizeString(company.razaoSocial), company.cnpj, company.uf, '', '', '', '0']);
    addLine(['0001', '0']); // 0 = Bloco com dados informados
    addLine(['0100', sanitizeString(company.razaoSocial), company.cnpj, '', '', '', '', '', '', '', '']);
    addLine(['0140', '001', sanitizeString(company.razaoSocial), company.cnpj, company.inscricaoEstadual, '', company.cidade, '', '']);
    addLine(['0500', formatDate(startDate), '01']); // Regime de Competência

    // Bloco A: Documentos Fiscais - Serviços (NFS-e)
    if (serviceLaunches.length > 0) {
        addLine(['A001', '0']);
        serviceLaunches.forEach(launch => {
            const valorTotal = launch.valorServicos || 0;
            const pisValue = launch.valorPis || 0;
            const cofinsValue = launch.valorCofins || 0;
            addLine([
                'A100', '2', '0', launch.tomador?.cnpj || '', '', '01', '01', '', launch.numeroNfse, launch.chaveNfe || '', formatDate(launch.date as Date), formatDate(launch.date as Date),
                formatValue(valorTotal), '1', formatValue(valorTotal - pisValue - cofinsValue), '0', formatValue(pisValue), formatValue(cofinsValue), '0', '0', '0'
            ]);
            addLine(['A170', '1', '', launch.discriminacao, formatValue(valorTotal), '0', '', '01', formatValue(valorTotal), '1.65', formatValue(pisValue), '7.60', formatValue(cofinsValue)]);
        });
    } else {
        addLine(['A001', '1']);
    }

    // Bloco C: Documentos Fiscais - Mercadorias (NF-e)
    if (salesLaunches.length > 0) {
        addLine(['C001', '0']);
        salesLaunches.forEach(launch => {
             const valorTotal = launch.valorTotalNota || 0;
             const pisValue = launch.valorPis || 0; // Assuming PIS/COFINS are calculated elsewhere and stored
             const cofinsValue = launch.valorCofins || 0;
             addLine([
                'C100', '1', '0', launch.destinatario?.cnpj, '55', '00', '01', '', launch.chaveNfe, formatDate(launch.date as Date), formatDate(launch.date as Date),
                 formatValue(valorTotal), '0', '0', formatValue(valorTotal), '9', '0', '0', formatValue(pisValue), formatValue(cofinsValue)
             ]);
        });
    } else {
        addLine(['C001', '1']);
    }
    
    // Bloco M: Apuração da Contribuição
    const totalRevenue = salesLaunches.reduce((acc, l) => acc + (l.valorTotalNota || 0), 0) + serviceLaunches.reduce((acc, l) => acc + (l.valorServicos || 0), 0);
    const totalPis = salesLaunches.reduce((acc, l) => acc + (l.valorPis || 0), 0) + serviceLaunches.reduce((acc, l) => acc + (l.valorPis || 0), 0);
    const totalCofins = salesLaunches.reduce((acc, l) => acc + (l.valorCofins || 0), 0) + serviceLaunches.reduce((acc, l) => acc + (l.valorCofins || 0), 0);
    addLine(['M001', '0']);
    addLine(['M200', formatValue(totalPis), '0', '0', '0', '0', '0', formatValue(totalPis)]); // PIS
    addLine(['M210', '01', formatValue(totalRevenue), '1.65', '0', formatValue(totalPis), '']);
    addLine(['M600', formatValue(totalCofins), '0', '0', '0', '0', '0', formatValue(totalCofins)]); // COFINS
    addLine(['M610', '01', formatValue(totalRevenue), '7.60', '0', formatValue(totalCofins), '']);

    // Bloco 9: Encerramento do Arquivo Digital
    addLine(['9001', '0']);
    const lineCount = txtContent.split(EOL).length;
    addLine(['9900', '0000', '1']);
    addLine(['9900', '0001', '1']);
    addLine(['9900', '0100', '1']);
    addLine(['9900', '0140', '1']);
    addLine(['9900', '0500', '1']);
    addLine(['9900', 'A001', '1']);
    if (serviceLaunches.length > 0) {
        addLine(['9900', 'A100', serviceLaunches.length]);
        addLine(['9900', 'A170', serviceLaunches.length]);
    }
    addLine(['9900', 'C001', '1']);
    if (salesLaunches.length > 0) {
         addLine(['9900', 'C100', salesLaunches.length]);
    }
    addLine(['9900', 'M001', '1']);
    addLine(['9900', 'M200', '1']);
    addLine(['9900', 'M210', '1']);
    addLine(['9900', 'M600', '1']);
    addLine(['9900', 'M610', '1']);
    addLine(['9900', '9001', '1']);
    addLine(['9900', '9900', lineCount - 1]); // Total records of 9900
    addLine(['9999', lineCount]); // Total lines in file
    

    // --- 3. CREATE AND DOWNLOAD FILE ---
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
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
