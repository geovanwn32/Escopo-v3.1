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
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const drawPayslip = (startY: number) => {
    let y = startY;

    // --- HEADER ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Recibo de Pagamento de Salário', 15, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Competência: ${payroll.period}`, pageWidth - 15, y, { align: 'right' });
    y += 8;

    // --- COMPANY & EMPLOYEE INFO ---
    autoTable(doc, {
        startY: y,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1, overflow: 'linebreak' },
        body: [
            [
                { content: 'Empregador:', styles: { fontStyle: 'bold' } },
                { content: company.razaoSocial, styles: { cellWidth: 80 } },
                { content: 'CNPJ:', styles: { fontStyle: 'bold' } },
                { content: formatCnpj(company.cnpj), styles: { cellWidth: 'auto' } },
            ],
            [
                { content: 'Funcionário(a):', styles: { fontStyle: 'bold' } },
                { content: employee.nomeCompleto },
                { content: 'Cargo:', styles: { fontStyle: 'bold' } },
                { content: employee.cargo },
            ],
        ],
    });
    y = (doc as any).lastAutoTable.finalY + 5;
    
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
            provento ? provento.provento.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
            desconto?.rubrica.codigo || '',
            desconto?.rubrica.descricao || '',
            desconto ? desconto.referencia.toFixed(2) : '',
            desconto ? desconto.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
        ]);
    }

    autoTable(doc, {
        startY: y,
        head: [['Cód.', 'Descrição', 'Referência', 'Proventos', 'Cód.', 'Descrição', 'Referência', 'Descontos']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [230, 230, 230], textColor: 0, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 35 },
            2: { cellWidth: 15, halign: 'right' },
            3: { cellWidth: 20, halign: 'right' },
            4: { cellWidth: 10 },
            5: { cellWidth: 35 },
            6: { cellWidth: 15, halign: 'right' },
            7: { cellWidth: 20, halign: 'right' },
        }
    });
    y = (doc as any).lastAutoTable.finalY;

    // --- TOTALS & SIGNATURE ---
     autoTable(doc, {
        startY: y,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1, fontStyle: 'bold' },
        body: [
            [
                { content: 'Total Vencimentos:', styles: { halign: 'left' } },
                { content: formatCurrency(payroll.totals.totalProventos), styles: { halign: 'right' } },
                { content: 'Total Descontos:', styles: { halign: 'left' } },
                { content: formatCurrency(payroll.totals.totalDescontos), styles: { halign: 'right' } },
                { content: '' },
            ],
            [
                { content: 'VALOR LÍQUIDO:', styles: { halign: 'left' } },
                { content: formatCurrency(payroll.totals.liquido), styles: { halign: 'right' } },
                { content: '' },
                { content: 'Assinatura:', styles: { halign: 'left' } },
                { content: '' },
            ],
        ],
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 40 },
            2: { cellWidth: 30 },
            3: { cellWidth: 40 },
            4: { cellWidth: 'auto' },
        }
    });
    return (doc as any).lastAutoTable.finalY;
  };

  // Draw first copy
  drawPayslip(15);
  
  // Draw separator
  doc.setLineDashPattern([2, 2], 0);
  doc.line(10, pageHeight / 2, pageWidth - 10, pageHeight / 2);
  doc.setLineDashPattern([], 0);

  // Draw second copy
  drawPayslip(pageHeight / 2 + 10);
  
  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
