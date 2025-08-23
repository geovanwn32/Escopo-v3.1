
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
    switch (launch.type) {
      case 'saida':
        return launch.destinatario?.nome || 'N/A';
      case 'servico':
        return launch.tomador?.nome || 'N/A';
      default:
        return 'N/A';
    }
  };

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

export async function generateSalesReportPdf(userId: string, company: Company, dateRange: DateRange) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = addHeader(doc, company);
    
    if (!dateRange.from || !dateRange.to) {
        throw new Error("Período de datas inválido.");
    }
    
    const startDate = Timestamp.fromDate(dateRange.from);
    const endDate = Timestamp.fromDate(new Date(dateRange.to.setHours(23, 59, 59, 999))); // Ensure end of day

    // --- FETCH DATA ---
    const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
    const q = query(launchesRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate)
    );

    const snapshot = await getDocs(q);
    const sales = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Launch))
        .filter(launch => (launch.type === 'saida' || launch.type === 'servico') && launch.status !== 'Cancelado')
        .sort((a,b) => ((b.date as any)?.toDate ? (b.date as any).toDate() : new Date(b.date)).getTime() - ((a.date as any)?.toDate ? (a.date as any).toDate() : new Date(a.date)).getTime());


    if (sales.length === 0) {
        throw new Error("Nenhuma venda ou serviço encontrado para o período selecionado.");
    }

    // --- PDF GENERATION ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Relatório de Vendas e Serviços`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${formatDate(dateRange.from)} a ${formatDate(dateRange.to)}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    let totalSalesValue = 0;
    const allTableRows = sales.map(sale => {
        const saleValue = sale.valorLiquido || sale.valorTotalNota || 0;
        totalSalesValue += saleValue;
        return [
            formatDate(sale.date),
            getPartnerName(sale),
            sale.chaveNfe || sale.numeroNfse || 'N/A',
            formatCurrency(saleValue)
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['Data', 'Cliente', 'Documento', 'Valor']],
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
            [{ content: 'Total de Vendas/Serviços', styles: { fontStyle: 'bold' } }, { content: sales.length, styles: { halign: 'right' } }],
            [{ content: 'Valor Total Faturado', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalSalesValue), styles: { halign: 'right', fontStyle: 'bold' } }],
        ],
    });

    doc.output('dataurlnewwindow');
}
