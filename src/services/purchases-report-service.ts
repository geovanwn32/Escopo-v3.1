
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Launch, Recibo } from '@/types';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const formatDate = (date: any): string => {
    if (!date) return '';
    try {
        const jsDate = date.toDate ? date.toDate() : new Date(date);
        if (isNaN(jsDate.getTime())) return '';
        return format(jsDate, 'dd/MM/yyyy');
    } catch {
        return '';
    }
}

function addHeader(doc: jsPDF, company: Company) {
    const pageWidth = doc.internal.pageSize.width;
    let y = 15;
    
    if (company.logoUrl) {
        try { doc.addImage(company.logoUrl, 'PNG', 14, y, 30, 15); }
        catch(e) { console.error("Could not add logo to PDF:", e); }
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(company.nomeFantasia.toUpperCase(), pageWidth - 14, y, { align: 'right' });
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(company.razaoSocial, pageWidth - 14, y, { align: 'right' });
    y += 4;
    doc.text(`CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth - 14, y, { align: 'right' });
    y += 4;
    const address = `${company.logradouro || ''}, ${company.numero || 'S/N'} - ${company.bairro || ''}`;
    doc.text(address, pageWidth - 14, y, { align: 'right' });
    y += 4;
    doc.text(`${company.cidade || ''}/${company.uf || ''} - CEP: ${company.cep || ''}`, pageWidth - 14, y, { align: 'right' });
     y += 4;
    doc.text(`Tel: ${company.telefone || ''} | Email: ${company.email || ''}`, pageWidth - 14, y, { align: 'right' });
    
    return y + 5;
}

export async function generatePurchasesReportPdf(userId: string, company: Company, dateRange: DateRange): Promise<boolean> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = addHeader(doc, company);
    
    // --- FETCH DATA ---
    const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
    const recibosRef = collection(db, `users/${userId}/companies/${company.id}/recibos`);
    
    let launchesQuery = query(launchesRef);
    let recibosQuery = query(recibosRef);

    if (dateRange.from) {
      const startDate = Timestamp.fromDate(dateRange.from);
      launchesQuery = query(launchesQuery, where('date', '>=', startDate));
      recibosQuery = query(recibosQuery, where('data', '>=', startDate));
    }
    if (dateRange.to) {
      const endDate = new Date(dateRange.to);
      endDate.setHours(23, 59, 59, 999);
      launchesQuery = query(launchesQuery, where('date', '<=', Timestamp.fromDate(endDate)));
      recibosQuery = query(recibosQuery, where('data', '<=', Timestamp.fromDate(endDate)));
    }

    const [launchesSnapshot, recibosSnapshot] = await Promise.all([
        getDocs(launchesQuery),
        getDocs(recibosQuery)
    ]);
    
    const launches = launchesSnapshot.docs
        .map(doc => ({ ...doc.data() } as Launch))
        .filter(launch => launch.type === 'entrada'); // Filter for 'entrada' on the client
        
    const recibos = recibosSnapshot.docs.map(doc => ({ ...doc.data() } as Recibo));

    const purchases: (Launch | Recibo)[] = [...launches, ...recibos];

    // Sort client-side by date
    purchases.sort((a, b) => {
        const dateA = (a as any).date ? ((a as any).date.toDate ? (a as any).date.toDate() : new Date((a as any).date)) : new Date();
        const dateB = (b as any).date ? ((b as any).date.toDate ? (b as any).date.toDate() : new Date((b as any).date)) : new Date();
        return dateB.getTime() - dateA.getTime();
    });

    if (purchases.length === 0) {
        return false;
    }

    // --- PDF GENERATION ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Relatório de Compras e Despesas`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let periodText = 'Período: Todos os lançamentos';
    if(dateRange.from && dateRange.to) {
        periodText = `Período: ${formatDate(dateRange.from)} a ${formatDate(dateRange.to)}`;
    }
    
    doc.text(periodText, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    let totalPurchasesValue = 0;
    const allTableRows = purchases.map(item => {
        let value = 0;
        let partnerName = 'N/A';
        let document = 'N/A';
        
        if ('type' in item && item.type === 'entrada') { // It's a Launch
            value = item.valorTotalNota || 0;
            partnerName = item.emitente?.nome || 'N/A';
            document = `NF-e ${item.chaveNfe || item.numeroNfse}`;
        } else if ('tipo' in item){ // It's a Recibo
            value = item.valor || 0;
            partnerName = item.pagadorNome;
            document = `${item.tipo} ${item.numero}`;
        }

        totalPurchasesValue += value;
        return [
            formatDate((item as any).date),
            partnerName,
            document,
            formatCurrency(value)
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['Data', 'Fornecedor/Pagador', 'Documento', 'Valor']],
        body: allTableRows,
        theme: 'grid',
        headStyles: { fillColor: [51, 145, 255], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 25, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 50 },
            3: { cellWidth: 30, halign: 'right' },
        }
    });

    y = (doc as any).lastAutoTable.finalY + 8;
    
    // --- SUMMARY ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo do Período', 14, y);
    y += 5;
    autoTable(doc, {
        startY: y,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2 },
        body: [
            [{ content: 'Total de Lançamentos', styles: { fontStyle: 'bold' } }, { content: purchases.length, styles: { halign: 'right' } }],
            [{ content: 'Valor Total em Compras/Despesas', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalPurchasesValue), styles: { halign: 'right', fontStyle: 'bold' } }],
        ],
    });

    doc.output('dataurlnewwindow');
    return true;
}
