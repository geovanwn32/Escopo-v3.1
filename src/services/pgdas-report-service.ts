
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';

export interface PGDASResult {
  rpa: number;
  rbt12: number;
  aliquotaNominal: number;
  parcelaDeduzir: number;
  aliquotaEfetiva: number;
  taxAmount: number;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const formatPercent = (value: number) => `${value.toFixed(4)}%`;

export function generatePgdasReportPdf(company: Company, period: string, result: PGDASResult) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let y = 15;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Demonstrativo de Cálculo do Simples Nacional', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${company.razaoSocial} - Competência: ${period}`, pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('I - Valores Base', 14, y);
  y += 5;
  autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      body: [
          ['Receita Bruta do Período de Apuração (RPA)', formatCurrency(result.rpa)],
          ['Receita Bruta dos Últimos 12 Meses (RBT12)', formatCurrency(result.rbt12)],
      ],
      columnStyles: { 0: { fontStyle: 'bold' } }
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('II - Cálculo da Alíquota Efetiva', 14, y);
  y += 5;
  
  const calculationSteps = [
    { label: 'RBT12 x Alíquota Nominal', value: formatCurrency(result.rbt12 * (result.aliquotaNominal / 100)) },
    { label: '(-) Parcela a Deduzir', value: formatCurrency(result.parcelaDeduzir) },
    { label: '(=) Valor Base para Alíquota', value: formatCurrency((result.rbt12 * (result.aliquotaNominal / 100)) - result.parcelaDeduzir) },
    { label: '(/) RBT12', value: formatCurrency(result.rbt12) },
    { label: '(=) Alíquota Efetiva', value: `${formatNumber(result.aliquotaEfetiva)}%`, isBold: true },
  ];

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    body: calculationSteps.map(step => [
        { content: step.label, styles: { fontStyle: step.isBold ? 'bold' : 'normal' } },
        { content: step.value, styles: { halign: 'right', fontStyle: step.isBold ? 'bold' : 'normal' } }
    ]),
    columnStyles: { 0: { fontStyle: 'bold' } }
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('III - Valor do Imposto (DAS)', 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, fontStyle: 'bold' },
    body: [
        ['Receita do Mês (RPA)', formatCurrency(result.rpa)],
        ['(x) Alíquota Efetiva', `${formatNumber(result.aliquotaEfetiva)}%`],
        [{ content: '(=) Valor do DAS a Pagar', styles: { fillColor: [240, 245, 255] } }, { content: formatCurrency(result.taxAmount), styles: { fillColor: [240, 245, 255] } }],
    ],
    columnStyles: { 1: { halign: 'right' } }
  });

  doc.output('dataurlnewwindow');
}
