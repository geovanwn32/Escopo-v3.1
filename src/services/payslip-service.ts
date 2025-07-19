import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/app/(app)/fiscal/page';
import type { Employee } from '@/types/employee';
import type { Payroll } from '@/types/payroll';
import { format } from 'date-fns';

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

const formatCpf = (cpf: string): string => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function generatePayslipPdf(company: Company, employee: Employee, payroll: Payroll) {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  let y = 15;

  // --- HEADER ---
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Holerite de Pagamento', 105, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Competência: ${payroll.period}`, 105, y, { align: 'center' });
  y += 10;
  
  // --- COMPANY INFO ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Empresa Contratante', 15, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5 },
    body: [
      [{ content: 'Razão Social:', styles: { fontStyle: 'bold' } }, company.razaoSocial, { content: 'CNPJ:', styles: { fontStyle: 'bold' } }, formatCnpj(company.cnpj)],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  
  // --- EMPLOYEE INFO ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Funcionário', 15, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5 },
    body: [
      [{ content: 'Nome:', styles: { fontStyle: 'bold' } }, employee.nomeCompleto, { content: 'CPF:', styles: { fontStyle: 'bold' } }, formatCpf(employee.cpf)],
      [{ content: 'Cargo:', styles: { fontStyle: 'bold' } }, employee.cargo, { content: 'Data Admissão:', styles: { fontStyle: 'bold' } }, format(employee.dataAdmissao, 'dd/MM/yyyy')],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 10;
  
  // --- PAYROLL EVENTS TABLE ---
  const proventos = payroll.events.filter(e => e.rubrica.tipo === 'provento');
  const descontos = payroll.events.filter(e => e.rubrica.tipo === 'desconto');
  
  const tableRows = [];
  const maxLength = Math.max(proventos.length, descontos.length);

  for (let i = 0; i < maxLength; i++) {
    const provento = proventos[i];
    const desconto = descontos[i];
    tableRows.push([
      provento?.rubrica.codigo || '',
      provento?.rubrica.descricao || '',
      provento ? provento.referencia.toFixed(2) : '',
      provento ? provento.provento.toFixed(2) : '',
      desconto?.rubrica.codigo || '',
      desconto?.rubrica.descricao || '',
      desconto ? desconto.referencia.toFixed(2) : '',
      desconto ? desconto.desconto.toFixed(2) : '',
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Cód.', 'Descrição', 'Referência', 'Proventos', 'Cód.', 'Descrição', 'Referência', 'Descontos']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: {
      3: { halign: 'right' },
      7: { halign: 'right' },
    }
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  // --- TOTALS ---
  const totalsData = [
    [
        { content: 'Total de Proventos:', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: formatCurrency(payroll.totals.totalProventos), styles: { halign: 'right' } },
        { content: 'Total de Descontos:', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: formatCurrency(payroll.totals.totalDescontos), styles: { halign: 'right' } },
    ],
  ];

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    body: totalsData
  });
  y = (doc as any).lastAutoTable.finalY + 1;
  doc.line(15, y, 195, y); // Separator line
  y += 5;

  // --- NET PAY ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Líquido a Receber:', 150, y, { align: 'right' });
  doc.text(formatCurrency(payroll.totals.liquido), 195, y, { align: 'right' });
  y += 15;

  // --- SIGNATURE LINE ---
  doc.line(40, y, 100, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Assinatura do Funcionário', 70, y + 4, { align: 'center' });


  // --- FOOTER ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount}`, 195, pageHeight - 10, { align: 'right' });
  }

  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
