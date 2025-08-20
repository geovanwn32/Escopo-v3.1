
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
import type { Vacation } from '@/types/vacation';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

const formatDate = (date: Date | undefined): string => {
    if (!date) return '';
    return format(date, 'dd/MM/yyyy');
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
    doc.text(company.razaoSocial.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const companyAddress = `${company.logradouro || ''}, ${company.numero || 'S/N'} - ${company.bairro || ''} - ${company.cidade || ''}/${company.uf || ''}`;
    doc.text(`CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text(companyAddress, pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text(`Tel: ${company.telefone || ''} | Email: ${company.email || ''}`, pageWidth / 2, y, { align: 'center' });
    
    return y + 5;
}

export function generateVacationNoticePdf(company: Company, employee: Employee, vacation: Vacation) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const primaryColor = [51, 145, 255];
  const destructiveColor = [220, 38, 38];
  let y = addHeader(doc, company);

  // --- TITLE ---
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AVISO E RECIBO DE FÉRIAS', pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  // --- IDENTIFICATION ---
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    head: [
        [{ content: 'Empregado(a)', colSpan: 2, styles: { fillColor: [240, 245, 255], textColor: 30, fontStyle: 'bold' } }]
    ],
    body: [
        [
            { content: 'Nome:', styles: { fontStyle: 'bold' } },
            employee.nomeCompleto,
        ],
        [
            { content: 'Cargo:', styles: { fontStyle: 'bold' } },
            employee.cargo,
        ],
        [
            { content: 'Data de Admissão:', styles: { fontStyle: 'bold' } },
            formatDate(employee.dataAdmissao),
        ],
    ],
    columnStyles: { 
        0: { cellWidth: 35 }, 
    }
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  
  // --- VACATION DETAILS ---
  const startDate = (vacation.startDate as any).toDate ? (vacation.startDate as any).toDate() : vacation.startDate;
  const endDate = addDays(startDate, vacation.vacationDays - 1);
  const paymentDate = subDays(startDate, 2);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhamento das Férias', 14, y);
  y += 5;

  autoTable(doc, {
      startY: y,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1.5 },
      body: [
          [{ content: 'Período Aquisitivo:', styles: { fontStyle: 'bold' } }, `${formatDate(employee.dataAdmissao)} a ${formatDate(subDays(addDays(employee.dataAdmissao, 365),1))}`],
          [{ content: 'Período de Gozo:', styles: { fontStyle: 'bold' } }, `${vacation.vacationDays} dias, de ${formatDate(startDate)} a ${formatDate(endDate)}`],
          [{ content: 'Data Limite para Pagamento:', styles: { fontStyle: 'bold' } }, `${formatDate(paymentDate)}`],
      ],
      columnStyles: { 0: { cellWidth: 50 } }
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // --- FINANCIAL VALUES ---
  const tableRows = vacation.result.events.map(event => [
        event.descricao,
        event.referencia,
        formatCurrency(event.provento),
        formatCurrency(event.desconto),
    ]);
  
  autoTable(doc, {
        startY: y,
        head: [['Discriminação dos Valores', 'Referência', 'Proventos (R$)', 'Descontos (R$)']],
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
                { content: formatCurrency(vacation.result.totalProventos), styles: { halign: 'right' } },
            ],
             [
                { content: 'Total de Descontos:', styles: { halign: 'right' } },
                { content: formatCurrency(vacation.result.totalDescontos), styles: { halign: 'right', textColor: destructiveColor } },
            ],
             [
                { content: 'LÍQUIDO A RECEBER:', styles: { halign: 'right', fillColor: [240, 245, 255] } },
                { content: formatCurrency(vacation.result.liquido), styles: { halign: 'right', fillColor: [240, 245, 255], textColor: primaryColor } },
            ],
        ],
         columnStyles: {
            0: { cellWidth: 126.8, styles: { cellPadding: { right: 2 } } },
            1: { cellWidth: 50 },
        }
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  
  // --- LEGAL BASIS & RECEIPT ---
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const legalText = `Comunicamos, em conformidade com o Art. 135 da Consolidação das Leis do Trabalho (CLT), que suas férias serão concedidas conforme detalhado acima. O pagamento da remuneração das férias, acrescida do terço constitucional, será efetuado até 2 (dois) dias antes do início do respectivo período de gozo, conforme § 1º do Art. 145 da CLT.`;
  doc.text(legalText, 14, y, { maxWidth: pageWidth - 28, lineHeightFactor: 1.5 });
  y += doc.getTextDimensions(legalText, { maxWidth: pageWidth - 28, lineHeightFactor: 1.5 }).h + 5;
  
  const receiptText = `Recebi de ${company.razaoSocial} a importância líquida de ${formatCurrency(vacation.result.liquido)}, referente ao pagamento das minhas férias, conforme discriminado neste recibo, do qual dou plena e total quitação.`
  doc.text(receiptText, 14, y, { maxWidth: pageWidth - 28, lineHeightFactor: 1.5 });
  y += doc.getTextDimensions(receiptText, { maxWidth: pageWidth - 28, lineHeightFactor: 1.5 }).h + 10;
  
  // --- SIGNATURES ---
  if (y > 250) y = 250; // a safe limit to avoid going off page

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
