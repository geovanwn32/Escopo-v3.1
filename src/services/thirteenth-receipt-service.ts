
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

const formatDate = (date: Date | undefined): string => {
    if (!date) return '';
    return format(date, 'dd/MM/yyyy');
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
  doc.text(`${getParcelLabel(thirteenth.parcel)} - Ano de Referência: ${thirteenth.year}`, pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.text(`${company.razaoSocial} | CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  // --- EMPLOYEE INFO ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('I - Identificação do Empregado', 14, y);
  y += 5;
   autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      body: [
          [{ content: 'Nome', styles: { fontStyle: 'bold' } }, employee.nomeCompleto],
          [{ content: 'Cargo', styles: { fontStyle: 'bold' } }, employee.cargo],
          [{ content: 'Data de Admissão', styles: { fontStyle: 'bold' } }, formatDate(employee.dataAdmissao)],
      ],
      columnStyles: { 0: { cellWidth: 40 } }
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  
  // --- PAYROLL EVENTS ---
  const tableRows = thirteenth.result.events.map(event => [
        event.descricao,
        event.referencia,
        formatCurrency(event.provento),
        formatCurrency(event.desconto),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Verba', 'Referência', 'Proventos (R$)', 'Descontos (R$)']],
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
        theme: 'grid',
        showHead: false,
        styles: { fontSize: 9, cellPadding: 1.5, fontStyle: 'bold' },
        body: [
             [
                { content: 'Total de Vencimentos:', styles: { halign: 'right' } },
                { content: formatCurrency(thirteenth.result.totalProventos), styles: { halign: 'right' } },
            ],
             [
                { content: 'Total de Descontos:', styles: { halign: 'right' } },
                { content: formatCurrency(thirteenth.result.totalDescontos), styles: { halign: 'right', textColor: [200, 0, 0] } },
            ],
             [
                { content: 'LÍQUIDO A RECEBER:', styles: { halign: 'right', fillColor: [240, 245, 255] } },
                { content: formatCurrency(thirteenth.result.liquido), styles: { halign: 'right', fillColor: [240, 245, 255] } },
            ],
        ],
         columnStyles: {
            0: { cellWidth: 126.8, styles: { cellPadding: { right: 2 } } },
            1: { cellWidth: 50 },
        }
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  
  // --- LEGAL BASIS ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('II - Embasamento Legal', 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const legalText = `O presente recibo é emitido em conformidade com a Lei nº 4.090/62 e o Decreto nº 57.155/65, que regulamentam o pagamento da Gratificação de Natal (13º Salário).`;
  doc.text(legalText, 14, y, { maxWidth: pageWidth - 28, lineHeightFactor: 1.5 });
  y += 15;


  // --- SIGNATURES ---
  const city = company.cidade || " ";
  const today = new Date();
  doc.setFontSize(10);
  doc.text(`${city}, ${format(today, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
  doc.text('Assinatura do Empregado(a)', pageWidth / 2, y + 4, { align: 'center' });
  

  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
