
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Launch } from '@/app/(app)/fiscal/page';
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

const getPartnerName = (launch: Launch): string => {
    if (launch.type === 'entrada') {
        return launch.emitente?.nome || 'N/A';
    }
    return 'N/A';
};

export async function generatePurchasesReportPdf(userId: string, company: Company, dateRange: DateRange): Promise<boolean> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 15;
    
    // --- FETCH DATA ---
    const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
    
    let q = query(launchesRef, where('type', '==', 'entrada'));

    if (dateRange.from) {
      q = query(q, where('date', '>=', Timestamp.fromDate(dateRange.from)));
    }
    if (dateRange.to) {
      const endDate = new Date(dateRange.to);
      endDate.setHours(23, 59, 59, 999);
      q = query(q, where('date', '<=', Timestamp.fromDate(endDate)));
    }

    const snapshot = await getDocs(q);
    
    // Sort client-side
    const purchases = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Launch))
        .sort((a,b) => ((b.date as any).toDate ? (b.date as any).toDate() : new Date(b.date)).getTime() - ((a.date as any).toDate ? (a.date as any).toDate() : new Date(a.date)).getTime());


    if (purchases.length === 0) {
        return false;
    }

    // --- PDF GENERATION ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Relatório de Compras`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let periodText = 'Período: Todos os lançamentos';
    if(dateRange.from && dateRange.to) {
        periodText = `Período: ${formatDate(dateRange.from)} a ${formatDate(dateRange.to)}`;
    }
    
    doc.text(periodText, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`${company.razaoSocial} | CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    let totalPurchasesValue = 0;
    const allTableRows = purchases.map(purchase => {
        const purchaseValue = purchase.valorTotalNota || 0;
        totalPurchasesValue += purchaseValue;
        return [
            formatDate(purchase.date),
            getPartnerName(purchase),
            purchase.chaveNfe || 'N/A',
            formatCurrency(purchaseValue)
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['Data', 'Fornecedor', 'Documento', 'Valor']],
        body: allTableRows,
        theme: 'grid',
        headStyles: { fillColor: [51, 145, 255], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 25, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 50, halign: 'center' },
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
            [{ content: 'Total de Compras', styles: { fontStyle: 'bold' } }, { content: purchases.length, styles: { halign: 'right' } }],
            [{ content: 'Valor Total em Compras', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalPurchasesValue), styles: { halign: 'right', fontStyle: 'bold' } }],
        ],
    });

    doc.output('dataurlnewwindow');
    return true;
}
