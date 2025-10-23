
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Recibo } from '@/types';
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


export async function generateReceiptsReportPdf(userId: string, company: Company, dateRange: DateRange): Promise<boolean> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = addHeader(doc, company);
    
    // --- FETCH DATA ---
    const recibosRef = collection(db, `users/${userId}/companies/${company.id}/recibos`);
    
    let q = query(recibosRef, where('tipo', '==', 'Recibo'));

    if (dateRange.from) {
      q = query(q, where('date', '>=', Timestamp.fromDate(dateRange.from)));
    }
    if (dateRange.to) {
      const endDate = new Date(dateRange.to);
      endDate.setHours(23, 59, 59, 999);
      q = query(q, where('date', '<=', Timestamp.fromDate(endDate)));
    }

    // Add ordering after all where clauses
    q = query(q, orderBy('date', 'desc'));

    const snapshot = await getDocs(q);
    const receipts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recibo));

    if (receipts.length === 0) {
        return false;
    }

    // --- PDF GENERATION ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Relatório de Recibos Emitidos`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let periodText = 'Período: Todos os lançamentos';
    if(dateRange.from && dateRange.to) {
        periodText = `Período: ${formatDate(dateRange.from)} a ${formatDate(dateRange.to)}`;
    }
    
    doc.text(periodText, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    let totalValue = 0;
    const allTableRows = receipts.map(item => {
        totalValue += item.valor;
        return [
            item.numero,
            formatDate(item.data),
            item.pagadorNome,
            item.referenteA,
            formatCurrency(item.valor)
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['Número', 'Data', 'Pagador', 'Referente a', 'Valor']],
        body: allTableRows,
        theme: 'grid',
        headStyles: { fillColor: [51, 145, 255], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 60 },
            4: { cellWidth: 30, halign: 'right' },
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
            [{ content: 'Total de Recibos Emitidos', styles: { fontStyle: 'bold' } }, { content: receipts.length, styles: { halign: 'right' } }],
            [{ content: 'Valor Total dos Recibos', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalValue), styles: { halign: 'right', fontStyle: 'bold' } }],
        ],
    });

    doc.output('dataurlnewwindow');
    return true;
}
