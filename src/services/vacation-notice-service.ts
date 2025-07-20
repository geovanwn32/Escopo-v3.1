
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/app/(app)/fiscal/page';
import type { Employee } from '@/types/employee';
import type { Vacation } from '@/types/vacation';
import { format, addDays, addYears, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCnpj = (cnpj: string): string => {
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

const formatDate = (date: Date | undefined): string => {
    if (!date) return '';
    return format(date, 'dd/MM/yyyy');
}

export function generateVacationNoticePdf(company: Company, employee: Employee, vacation: Vacation) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let y = 15;

  // --- HEADER ---
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AVISO DE FÉRIAS', pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  // --- IDENTIFICAÇÃO ---
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    head: [
        [{ content: 'Empregador', colSpan: 2, styles: { fillColor: [240, 245, 255], textColor: 30, fontStyle: 'bold' } }, { content: 'Empregado(a)', colSpan: 2, styles: { fillColor: [240, 245, 255], textColor: 30, fontStyle: 'bold' } }]
    ],
    body: [
        [
            { content: 'Razão Social:', styles: { fontStyle: 'bold' } },
            company.razaoSocial,
            { content: 'Nome:', styles: { fontStyle: 'bold' } },
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
  
  // --- PERÍODO AQUISITIVO E GOZO ---
  const startDate = (vacation.startDate as any).toDate ? (vacation.startDate as any).toDate() : vacation.startDate;
  const endDate = addDays(startDate, vacation.vacationDays - 1);
  const acquisitionEnd = addYears(employee.dataAdmissao, 1);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhamento das Férias', 14, y);
  y += 5;

  autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      body: [
          [{ content: 'Período Aquisitivo:', styles: { fontStyle: 'bold' } }, `${formatDate(employee.dataAdmissao)} a ${formatDate(subDays(acquisitionEnd, 1))}`],
          [{ content: 'Período de Gozo:', styles: { fontStyle: 'bold' } }, `${vacation.vacationDays} dias, de ${formatDate(startDate)} a ${formatDate(endDate)}`],
          ...(vacation.sellVacation ? [[{ content: 'Abono Pecuniário:', styles: { fontStyle: 'bold' } }, 'Solicitada a conversão de 10 dias de férias em abono.']] : []),
          ...(vacation.advanceThirteenth ? [[{ content: 'Adiantamento 13º Salário:', styles: { fontStyle: 'bold' } }, 'Concedido o adiantamento da 1ª parcela do 13º salário.']] : []),
      ],
      columnStyles: { 0: { cellWidth: 45 } }
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // --- EMBASAMENTO LEGAL ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Embasamento Legal', 14, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const legalText = `Prezado(a) Sr(a). ${employee.nomeCompleto.split(' ')[0]}, comunicamos, em conformidade com o Art. 135 da Consolidação das Leis do Trabalho (CLT), que suas férias serão concedidas conforme detalhado acima. O pagamento das verbas de férias será realizado até 2 (dois) dias antes do início do respectivo período de gozo, conforme § 1º do Art. 145 da CLT.`;
  doc.text(legalText, 14, y, { maxWidth: pageWidth - 28, lineHeightFactor: 1.5 });
  y = (doc as any).lastAutoTable.finalY + 70; // Adjust y position for signatures dynamically

  if(y > 240) y = 240; // a safe limit to avoid going off page

  // --- ASSINATURAS ---
  const city = "São Paulo"; // Placeholder
  const today = new Date();
  doc.setFontSize(10);
  doc.text(`${city}, ${format(today, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
  doc.text('Assinatura do Empregador', pageWidth / 2, y + 4, { align: 'center' });
  y += 15;
  
  doc.setFontSize(9);
  doc.text(`Ciente em ____/____/____.`, 14, y);
  y += 8;

  doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
  doc.text('Assinatura do Empregado(a)', pageWidth / 2, y + 4, { align: 'center' });
  

  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
