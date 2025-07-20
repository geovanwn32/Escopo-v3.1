
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/app/(app)/fiscal/page';
import type { Employee } from '@/types/employee';
import type { Vacation } from '@/types/vacation';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCnpj = (cnpj: string): string => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

const formatDate = (date: Date | undefined): string => {
    if (!date) return '';
    return format(date, 'dd/MM/yyyy');
}

export function generateVacationNoticePdf(company: Company, employee: Employee, vacation: Vacation) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let y = 20;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AVISO DE FÉRIAS', pageWidth / 2, y, { align: 'center' });
  y += 20;

  // Company Info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Empregador:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(company.razaoSocial, 40, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('CNPJ:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCnpj(company.cnpj), 40, y);
  y += 10;
  
  // Employee Info
  doc.setFont('helvetica', 'bold');
  doc.text('Empregado(a):', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(employee.nomeCompleto, 43, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Cargo:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(employee.cargo, 43, y);
  y += 15;

  // Main text
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const startDate = (vacation.startDate as any).toDate ? (vacation.startDate as any).toDate() : vacation.startDate;
  const endDate = addDays(startDate, vacation.vacationDays -1);

  const noticeText = `Prezado(a) Sr(a). ${employee.nomeCompleto.split(' ')[0]},\n\n` +
  `Comunicamos, de acordo com o que estabelece o Art. 135 da CLT, que suas férias relativas ao ` +
  `período aquisitivo de ${format(employee.dataAdmissao, 'dd/MM/yyyy')} a ${format(addDays(employee.dataAdmissao, 364), 'dd/MM/yyyy')} ` +
  `serão concedidas a partir de ${format(startDate, 'dd/MM/yyyy')}.`;

  doc.text(noticeText, 14, y, { maxWidth: pageWidth - 28, lineHeightFactor: 1.5 });
  y += 40;
  
  // Vacation Details
  doc.setFont('helvetica', 'bold');
  doc.text('Período de Gozo:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${vacation.vacationDays} dias, de ${formatDate(startDate)} a ${formatDate(endDate)}`, 45, y);
  y += 10;
  
  if (vacation.sellVacation) {
    doc.setFont('helvetica', 'bold');
    doc.text('Abono Pecuniário:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Solicitada a conversão de 10 dias de férias em abono.`, 48, y);
    y += 10;
  }
  
  if (vacation.advanceThirteenth) {
    doc.setFont('helvetica', 'bold');
    doc.text('Adianto 13º Salário:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Concedido o adiantamento da 1ª parcela do 13º salário.`, 52, y);
    y += 15;
  }

  // City and Date
  const city = "São Paulo"; // Placeholder
  const today = new Date();
  doc.text(`${city}, ${format(today, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, pageWidth - 14, y, { align: 'right' });
  y += 25;


  // Signatures
  let signatureY = pageHeight - 60;
  doc.line(30, signatureY, 90, signatureY);
  doc.text('Assinatura do Empregador', 60, signatureY + 5, { align: 'center' });

  doc.line(pageWidth - 90, signatureY, pageWidth - 30, signatureY);
  doc.text('Assinatura do Empregado(a)', pageWidth - 60, signatureY + 5, { align: 'center' });
  signatureY += 15;

  doc.setFontSize(8);
  doc.text('Ciente em: ____/____/______', pageWidth - 60, signatureY, { align: 'center' });


  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
