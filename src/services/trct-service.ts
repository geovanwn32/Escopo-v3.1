
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
import type { Termination } from '@/types/termination';
import { format } from 'date-fns';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

const formatCpf = (cpf: string): string => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

const formatDate = (date: Date | undefined): string => {
    if (!date) return '';
    return format(date, 'dd/MM/yyyy');
}


export function generateTrctPdf(company: Company, employee: Employee, termination: Termination) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const primaryColor = [51, 145, 255];
  const destructiveColor = [220, 38, 38];

  let y = 10;
  
  // Header
  if (company.logoUrl) {
    // Note: jsPDF requires image data, not just a URL. This is a simplified example.
    // In a real app, you might need to fetch the image and convert it to a data URI.
    // For simplicity, we'll assume a placeholder or that this logic is handled elsewhere.
    try {
        doc.addImage(company.logoUrl, 'PNG', 14, y, 30, 15);
    } catch(e) {
        console.error("Could not add logo to PDF:", e);
    }
  }
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Termo de Rescisão do Contrato de Trabalho - TRCT', pageWidth / 2, y + 5, { align: 'center' });
  y += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const companyAddress = `${company.logradouro || ''}, ${company.numero || ''} - ${company.bairro || ''}, ${company.cidade || ''} - ${company.uf || ''}`;
  doc.text(`${company.razaoSocial} | CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth / 2, y, { align: 'center' });
  y += 5;
  
  // Identification of Employer
  doc.setFontSize(12);
  doc.text('I - Identificação do Empregador', 14, y);
  y += 5;
  autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      body: [
          [{ content: '01 Razão Social/Nome', styles: { fontStyle: 'bold' } }, company.razaoSocial],
          [{ content: '02 CNPJ/CEI/CNO', styles: { fontStyle: 'bold' } }, formatCnpj(company.cnpj)],
          [{ content: '03 Endereço (Logradouro, nº, bairro)', styles: { fontStyle: 'bold' } }, `${company.logradouro || ''}, ${company.numero || ''}, ${company.bairro || ''}`],
          [{ content: '04 Município/UF', styles: { fontStyle: 'bold' } }, `${company.cidade || ''}/${company.uf || ''}`],
          [{ content: '05 CEP', styles: { fontStyle: 'bold' } }, company.cep ? company.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : ''],
      ],
      columnStyles: { 0: { cellWidth: 50 } }
  });
  y = (doc as any).lastAutoTable.finalY + 5;
  
  // Identification of Employee
  doc.setFontSize(12);
  doc.text('II - Identificação do Trabalhador', 14, y);
  y += 5;
   autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      body: [
          [{ content: '09 Nome', styles: { fontStyle: 'bold' } }, employee.nomeCompleto],
          [{ content: '10 CPF', styles: { fontStyle: 'bold' } }, formatCpf(employee.cpf)],
          [{ content: '11 Data de Nascimento', styles: { fontStyle: 'bold' } }, formatDate(employee.dataNascimento)],
          [{ content: '12 Nome da Mãe', styles: { fontStyle: 'bold' } }, employee.nomeMae],
          [{ content: '13 CTPS (Nº, Série, UF)', styles: { fontStyle: 'bold' } }, ''], // Placeholder for CTPS
      ],
      columnStyles: { 0: { cellWidth: 50 } }
  });
  y = (doc as any).lastAutoTable.finalY + 5;
  
  // Contract Data
  doc.setFontSize(12);
  doc.text('III - Dados do Contrato', 14, y);
  y += 5;
  autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      body: [
          [{ content: '21 Cargo', styles: { fontStyle: 'bold' } }, employee.cargo],
          [{ content: '22 Salário Base', styles: { fontStyle: 'bold' } }, formatCurrency(employee.salarioBase)],
          [{ content: '23 Data de Admissão', styles: { fontStyle: 'bold' } }, formatDate(employee.dataAdmissao)],
          [{ content: '24 Data de Afastamento', styles: { fontStyle: 'bold' } }, formatDate(termination.terminationDate as Date)],
          [{ content: '25 Causa do Afastamento', styles: { fontStyle: 'bold' } }, termination.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())],
      ],
      columnStyles: { 0: { cellWidth: 50 } }
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // Verbas Rescisórias
  doc.setFontSize(12);
  doc.text('IV - Discriminação das Verbas Rescisórias', 14, y);
  y += 5;
  
   const tableRows = termination.result.events.map(event => [
        event.descricao,
        event.referencia,
        formatCurrency(event.provento),
        formatCurrency(event.desconto),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Verba Rescisória', 'Referência', 'Proventos', 'Descontos']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' },
        }
    });
    y = (doc as any).lastAutoTable.finalY;

    // Totals
    autoTable(doc, {
        startY: y,
        theme: 'grid',
        showHead: false,
        styles: { fontSize: 8, cellPadding: 1.5, fontStyle: 'bold' },
        body: [
             [
                { content: 'Total Bruto', styles: { halign: 'right' } },
                { content: formatCurrency(termination.result.totalProventos), styles: { halign: 'right' } },
            ],
             [
                { content: 'Total Deduções', styles: { halign: 'right' } },
                { content: formatCurrency(termination.result.totalDescontos), styles: { halign: 'right', textColor: destructiveColor } },
            ],
            [
                { content: 'Valor Líquido', styles: { halign: 'right' } },
                { content: formatCurrency(termination.result.liquido), styles: { halign: 'right', textColor: primaryColor } },
            ]
        ],
        columnStyles: {
            0: { cellWidth: 121.8, styles: { cellPadding: { right: 2 } } },
            1: { cellWidth: 'auto' },
        }
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    
    // Legal Basis
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('V - Embasamento Legal', 14, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('O presente termo é emitido em conformidade com o Art. 477 da Consolidação das Leis do Trabalho (CLT), que dispõe sobre a anotação na Carteira de Trabalho e o pagamento das verbas rescisórias.', 14, y, { maxWidth: pageWidth - 28 });
    y += 12;

    // Signatures
    doc.setFontSize(10);
    doc.text('__________________________________', 14, y);
    doc.text('__________________________________', pageWidth / 2 + 10, y);
    y += 4;
    doc.text('Assinatura do Empregador', 14, y);
    doc.text('Assinatura do Trabalhador', pageWidth / 2 + 10, y);


  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
