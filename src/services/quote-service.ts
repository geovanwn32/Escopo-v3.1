
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';
import type { Partner } from '@/types/partner';
import type { QuoteFormData } from '@/app/(app)/fiscal/orcamento/page';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj?: string): string => {
    if (!cnpj) return '';
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function generateQuotePdf(company: Company, partner: Partner, quoteData: QuoteFormData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let y = 15;

  // --- HEADER ---
  if (company.logoUrl) {
    try {
      // Note: jsPDF can have CORS issues with external URLs. A proxy or base64 conversion might be needed in a real scenario.
      // This is a simplified attempt.
      doc.addImage(company.logoUrl, 'PNG', 14, y, 30, 15);
    } catch (e) {
      console.error("Could not add logo to PDF. CORS might be an issue.", e);
    }
  }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Orçamento de Venda / Serviço', pageWidth - 14, y + 5, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(company.razaoSocial, pageWidth - 14, y + 10, { align: 'right' });
  doc.text(`CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth - 14, y + 14, { align: 'right' });
  doc.text(`${company.logradouro || ''}, ${company.numero || ''} - ${company.cidade || ''}/${company.uf || ''}`, pageWidth - 14, y + 18, { align: 'right' });
  
  y += 30;

  // --- CLIENT INFO ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(partner.razaoSocial, 14, y);
  y += 5;
  doc.text(`CNPJ/CPF: ${formatCnpj(partner.cpfCnpj)}`, 14, y);
  y += 5;
  const partnerAddress = `${partner.logradouro || ''}, ${partner.numero || ''} - ${partner.cidade || ''}/${partner.uf || ''}`;
  doc.text(`Endereço: ${partnerAddress}`, 14, y);
  y += 10;
  
  const today = new Date();
  doc.text(`Data do Orçamento: ${format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, 14, y);
  y += 10;

  // --- ITEMS TABLE ---
  const tableRows = quoteData.items.map(item => [
      item.description,
      item.quantity,
      formatCurrency(item.unitPrice),
      formatCurrency(item.total)
    ]);
  
  const total = quoteData.items.reduce((acc, item) => acc + item.total, 0);

  autoTable(doc, {
      startY: y,
      head: [['Descrição do Item', 'Quantidade', 'Valor Unitário', 'Subtotal']],
      body: tableRows,
      foot: [
        [{ content: 'TOTAL DO ORÇAMENTO', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, 
         { content: formatCurrency(total), styles: { fontStyle: 'bold', halign: 'right' } }]
      ],
      theme: 'striped',
      headStyles: { fillColor: [51, 145, 255], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 245, 255], textColor: 0 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' },
      }
  });

  y = (doc as any).lastAutoTable.finalY + 15;
  
  // --- FOOTER NOTES ---
  doc.setFontSize(9);
  doc.text('Observações:', 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.text('- Este orçamento é válido por 15 dias a contar da data de emissão.', 14, y);
  y += 4;
  doc.text('- O prazo de entrega/execução será combinado após a aprovação deste orçamento.', 14, y);
  
  // --- SIGNATURE AREA ---
  y = doc.internal.pageSize.height - 30;
  doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
  doc.text('Aprovação do Cliente', pageWidth / 2, y + 4, { align: 'center' });

  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
