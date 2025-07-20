
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
import type { Thirteenth } from '@/types/thirteenth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

const getParcelLabel = (parcel: string): string => {
    switch(parcel) {
        case 'first': return '1ª Parcela';
        case 'second': return '2ª Parcela';
        case 'unique': return 'Parcela Única';
        default: return parcel;
    }
};

export function generateThirteenthReceiptPdf(company: Company, employee: Employee, thirteenth: Thirteenth) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let y = 15;

  // --- HEADER ---
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Recibo de Pagamento de 13º Salário`, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${getParcelLabel(thirteenth.parcel)} - Ano: ${thirteenth.year}`, pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  // --- IDENTIFICAÇÃO ---
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    body: [
        [
            { content: 'Empregador:', styles: { fontStyle: 'bold' } },
            company.razaoSocial,
            { content: 'Empregado(a):', styles: { fontStyle: 'bold' } },
            employee.nomeCompleto,
        ],
        [
            { content: 'CNPJ:', styles: { fontStyle: 'bold' } },
            formatCnpj(company.cnpj),
            { content: 'Cargo:', styles: { fontStyle: 'bold' } },
            employee.cargo,
        ],
    ],
    columnStyles: { 
        0: { cellWidth: 30 }, 
        2: { cellWidth: 30 }
    }
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  
  // --- DETALHAMENTO ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhamento do Cálculo', 14, y);
  y += 5;

  const tableRows = thirteenth.result.events.map(event => [
        event.descricao,
        event.referencia,
        formatCurrency(event.provento),
        formatCurrency(event.desconto),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Descrição', 'Referência', 'Proventos (R$)', 'Descontos (R$)']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 35, halign: 'right' },
        }
    });
    y = (doc as any).lastAutoTable.finalY;

    // --- TOTALS ---
     autoTable(doc, {
        startY: y,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1.5, fontStyle: 'bold' },
        body: [
             [
                { content: 'Total de Vencimentos:', styles: { halign: 'right' } },
                { content: formatCurrency(thirteenth.result.totalProventos), styles: { halign: 'right' } },
            ],
             [
                { content: 'Total de Descontos:', styles: { halign: 'right' } },
                { content: formatCurrency(thirteenth.result.totalDescontos), styles: { halign: 'right' } },
            ],
             [
                { content: 'LÍQUIDO A RECEBER:', styles: { halign: 'right' } },
                { content: formatCurrency(thirteenth.result.liquido), styles: { halign: 'right' } },
            ],
        ],
         columnStyles: {
            0: { cellWidth: 126.8, styles: { cellPadding: { right: 2 } } },
            1: { cellWidth: 50 },
        }
    });
    y = (doc as any).lastAutoTable.finalY + 15;

  // --- ASSINATURAS ---
  const city = "São Paulo"; // Placeholder
  const today = new Date();
  doc.setFontSize(10);
  doc.text(`${city}, ${format(today, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
  doc.text('Assinatura do Empregado(a)', pageWidth / 2, y + 4, { align: 'center' });
  

  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
