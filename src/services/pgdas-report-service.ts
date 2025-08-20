
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';
import { getTaxDistribution } from './tax-distribution-service';
import type { SimplesAnnexType } from '@/types/pgdas';

export interface PGDASResult {
  rpa: number;
  rbt12: number;
  aliquotaNominal: number;
  parcelaDeduzir: number;
  aliquotaEfetiva: number;
  taxAmount: number;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
const formatPercent = (value: number) => `${formatNumber(value)}%`;

const formatCnpj = (cnpj: string): string => {
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
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

export function generatePgdasReportPdf(company: Company, period: string, result: PGDASResult, annex: SimplesAnnexType) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let y = addHeader(doc, company);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Demonstrativo de Cálculo do Simples Nacional', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Competência: ${period}`, pageWidth / 2, y, { align: 'center' });
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
          ['Anexo Utilizado para Cálculo', annex.replace('anexo-', 'Anexo ').toUpperCase()],
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
    { label: '(=) Alíquota Efetiva', value: `${formatPercent(result.aliquotaEfetiva)}`, isBold: true },
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
        ['(x) Alíquota Efetiva', `${formatPercent(result.aliquotaEfetiva)}`],
        [{ content: '(=) Valor do DAS a Pagar', styles: { fillColor: [240, 245, 255] } }, { content: formatCurrency(result.taxAmount), styles: { fillColor: [240, 245, 255] } }],
    ],
    columnStyles: { 1: { halign: 'right' } }
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // --- DETAILED TAX BREAKDOWN ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('IV - Detalhamento do DAS por Tributo', 14, y);
  y += 5;

  const taxDistribution = getTaxDistribution(annex, result.rbt12);
  const totalDistributionPercent = Object.values(taxDistribution).reduce((acc, val) => acc + val, 0);

  const breakdownRows = Object.entries(taxDistribution).map(([tax, percent]) => {
      const effectiveTaxPercent = (result.aliquotaEfetiva / totalDistributionPercent) * percent;
      const taxValue = result.rpa * (effectiveTaxPercent / 100);
      return [
          tax,
          formatPercent(effectiveTaxPercent),
          formatCurrency(taxValue)
      ];
  });

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['Tributo', 'Alíquota Efetiva', 'Valor (R$)']],
    body: breakdownRows,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right' },
    }
  });


  doc.output('dataurlnewwindow');
}
