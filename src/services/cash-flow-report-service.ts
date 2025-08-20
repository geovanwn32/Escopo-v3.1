
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
      case 'saida': return launch.destinatario?.nome || 'N/A';
      case 'servico': return launch.tomador?.nome || 'N/A';
      case 'entrada': return launch.emitente?.nome || 'N/A';
      default: return 'N/A';
    }
};

const getTypeLabel = (type?: Launch['type']): string => {
     switch (type) {
        case 'entrada': return 'Saída de Caixa';
        case 'saida': return 'Entrada de Caixa';
        case 'servico': return 'Entrada de Caixa';
        default: return 'N/A';
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

export function generateCashFlowReportPdf(
    company: Company, 
    launches: Launch[], 
    totals: { entradas: number, saidas: number },
    dateRange?: DateRange
) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = addHeader(doc, company);

    // --- PDF GENERATION ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Relatório de Fluxo de Caixa`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let periodText = 'Período: ';
    if (dateRange?.from) periodText += formatDate(dateRange.from);
    if (dateRange?.from && dateRange?.to) periodText += ' a ';
    if (dateRange?.to) periodText += formatDate(dateRange.to);
    else if (!dateRange?.from) periodText = 'Período: Todos os lançamentos';
    
    doc.text(periodText, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // --- SUMMARY ---
    autoTable(doc, {
        startY: y,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2 },
        head: [[{ content: 'Resumo do Período', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 245, 255] } }]],
        body: [
            ['Total de Entradas', { content: formatCurrency(totals.entradas), styles: { halign: 'right', textColor: [0, 128, 0] } }],
            ['Total de Saídas', { content: formatCurrency(totals.saidas), styles: { halign: 'right', textColor: [220, 38, 38] } }],
            [{ content: 'Saldo do Período', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totals.entradas - totals.saidas), styles: { halign: 'right', fontStyle: 'bold' } }],
        ],
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    
    const allTableRows = launches.map(launch => {
        const value = launch.valorLiquido || launch.valorTotalNota || 0;
        return [
            formatDate(launch.date),
            getPartnerName(launch),
            getTypeLabel(launch.type),
            { content: formatCurrency(value), styles: {textColor: (launch.type === 'entrada' ? [220, 38, 38] : [0, 128, 0])} }
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['Data', 'Parceiro', 'Tipo', 'Valor']],
        body: allTableRows,
        theme: 'striped',
        headStyles: { fillColor: [51, 145, 255], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 25, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 35, halign: 'center' },
            3: { cellWidth: 30, halign: 'right' },
        }
    });

    doc.output('dataurlnewwindow');
}
