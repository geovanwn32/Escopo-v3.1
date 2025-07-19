import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/app/(app)/fiscal/page';
import type { Employee } from '@/types/employee';
import type { Payroll } from '@/types/payroll';

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
  const primaryColor = [51, 145, 255]; // #3391FF

  const drawPayslip = (startY: number) => {
    let y = startY;

    // --- HEADER ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(14, y, pageWidth - 28, 10, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Recibo de Pagamento de Salário', pageWidth / 2, y + 6.5, { align: 'center' });
    y += 12;

    // --- COMPANY & EMPLOYEE INFO ---
    autoTable(doc, {
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
        head: [
            [{ content: 'Empregador', colSpan: 2, styles: { fillColor: [240, 245, 255], textColor: 30, fontStyle: 'bold' } }, { content: 'Funcionário(a)', colSpan: 2, styles: { fillColor: [240, 245, 255], textColor: 30, fontStyle: 'bold' } }]
        ],
        body: [
            [
                { content: 'Razão Social:', styles: { fontStyle: 'bold' } },
                { content: company.razaoSocial },
                { content: 'Nome:', styles: { fontStyle: 'bold' } },
                { content: employee.nomeCompleto },
            ],
            [
                { content: 'CNPJ:', styles: { fontStyle: 'bold' } },
                { content: formatCnpj(company.cnpj) },
                { content: 'Cargo:', styles: { fontStyle: 'bold' } },
                { content: employee.cargo },
            ],
            [
                { content: 'Competência:', styles: { fontStyle: 'bold' } },
                { content: payroll.period },
                { content: 'CPF:', styles: { fontStyle: 'bold' } },
                { content: formatCpf(employee.cpf) },
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
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 35 },
            2: { cellWidth: 15, halign: 'right' },
            3: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
            4: { cellWidth: 10, halign: 'center' },
            5: { cellWidth: 35 },
            6: { cellWidth: 15, halign: 'right' },
            7: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
        }
    });
    y = (doc as any).lastAutoTable.finalY;

    // --- TOTALS & SIGNATURE ---
     autoTable(doc, {
        startY: y,
        theme: 'grid',
        showHead: false,
        styles: { fontSize: 8, cellPadding: 1.5, fontStyle: 'bold' },
        body: [
            [
                { content: 'Total Vencimentos:', styles: { halign: 'right' } },
                { content: formatCurrency(payroll.totals.totalProventos), styles: { halign: 'right' } },
                { content: 'Total Descontos:', styles: { halign: 'right' } },
                { content: formatCurrency(payroll.totals.totalDescontos), styles: { halign: 'right', textColor: [200, 0, 0] } },
                { content: 'LÍQUIDO A RECEBER:', styles: { halign: 'right', fillColor: [240, 245, 255] } },
                { content: formatCurrency(payroll.totals.liquido), styles: { halign: 'right', fillColor: [240, 245, 255] } },
            ],
        ],
        columnStyles: {
            0: { cellWidth: 30 }, 1: { cellWidth: 20 },
            2: { cellWidth: 30 }, 3: { cellWidth: 20 },
            4: { cellWidth: 30 }, 5: { cellWidth: 'auto' },
        }
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    
    doc.setFontSize(8);
    doc.setTextColor(100);
    const signatureText = `Declaro ter recebido a importância líquida descrita neste recibo, correspondente aos meus serviços prestados na competência mencionada.`;
    doc.text(signatureText, 14, y, { maxWidth: pageWidth - 28 });
    y += 10;
    
    doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
    doc.text('Assinatura do Funcionário(a)', pageWidth / 2, y + 4, { align: 'center' });
    
    return y + 10;
  };

  // Draw first copy
  const firstCopyEndY = drawPayslip(15);
  
  // Draw separator
  doc.setLineDashPattern([2, 2], 0);
  doc.line(10, firstCopyEndY, pageWidth - 10, firstCopyEndY);
  doc.setLineDashPattern([], 0);

  // Draw second copy
  drawPayslip(firstCopyEndY + 10);
  
  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
