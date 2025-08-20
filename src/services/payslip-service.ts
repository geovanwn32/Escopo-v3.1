
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/app/(app)/fiscal/page';
import type { Employee } from '@/types/employee';
import type { Payroll } from '@/types/payroll';

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

export function generatePayslipPdf(company: Company, employee: Employee, payroll: Payroll) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const primaryColor = [51, 145, 255]; // #3391FF
  const destructiveColor = [220, 38, 38];

  const drawPayslip = (startY: number) => {
    let y = startY;

    // --- TITLE ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Recibo de Pagamento de Salário', pageWidth / 2, y, { align: 'center' });
    y += 8;

    // --- COMPANY & EMPLOYEE INFO ---
    autoTable(doc, {
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
        head: [
            [{ content: 'Empregado(a)', colSpan: 2, styles: { fillColor: [240, 245, 255], textColor: 30, fontStyle: 'bold' } }]
        ],
        body: [
            [
                { content: 'Nome:', styles: { fontStyle: 'bold' } },
                { content: employee.nomeCompleto },
            ],
            [
                { content: 'Cargo:', styles: { fontStyle: 'bold' } },
                { content: employee.cargo },
            ],
            [
                { content: 'Competência:', styles: { fontStyle: 'bold' } },
                { content: payroll.period },
            ],
        ],
        columnStyles: { 
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto' },
        }
    });
    y = (doc as any).lastAutoTable.finalY + 5;
    
    // --- PAYROLL EVENTS TABLE (Vertical Layout) ---
    const tableRows = payroll.events.map(event => {
        const proventoValue = event.rubrica.tipo === 'provento' ? event.provento.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
        const descontoValue = event.rubrica.tipo === 'desconto' ? event.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';

        return [
            event.rubrica.codigo,
            event.rubrica.descricao,
            event.referencia.toFixed(2),
            proventoValue,
            descontoValue,
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['Cód.', 'Descrição', 'Referência', 'Proventos', 'Descontos']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20, halign: 'right' },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 25, halign: 'right' },
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
                { content: 'Total de Vencimentos:', styles: { halign: 'right' } },
                { content: formatCurrency(payroll.totals.totalProventos), styles: { halign: 'right' } },
                { content: 'Total de Descontos:', styles: { halign: 'right' } },
                { content: formatCurrency(payroll.totals.totalDescontos), styles: { halign: 'right', textColor: destructiveColor } },
            ],
             [
                { content: '', colSpan: 2 },
                { content: 'LÍQUIDO A RECEBER:', styles: { halign: 'right', fillColor: [240, 245, 255] } },
                { content: formatCurrency(payroll.totals.liquido), styles: { halign: 'right', fillColor: [240, 245, 255], textColor: primaryColor } },
            ],
        ],
        columnStyles: {
            0: { cellWidth: 'auto' }, 
            1: { cellWidth: 25 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 25 },
        }
    });
    y = (doc as any).lastAutoTable.finalY;

    // --- CALCULATION BASES ---
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      showHead: false,
      styles: { fontSize: 8, cellPadding: 1.5 },
      body: [
        [
          { content: 'Base INSS:', styles: { fontStyle: 'bold' } },
          { content: formatCurrency(payroll.baseINSS), styles: { halign: 'left' } },
          { content: 'Base FGTS:', styles: { fontStyle: 'bold' } },
          { content: formatCurrency(payroll.baseFGTS), styles: { halign: 'left' } },
          { content: 'FGTS do Mês:', styles: { fontStyle: 'bold' } },
          { content: formatCurrency(payroll.fgtsValue), styles: { halign: 'left' } },
        ],
        [
          { content: 'Base IRRF:', styles: { fontStyle: 'bold' } },
          { content: formatCurrency(payroll.baseIRRF), styles: { halign: 'left' } },
          { content: '', colSpan: 4 },
        ],
      ],
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 41.33 },
        2: { cellWidth: 20 },
        3: { cellWidth: 41.33 },
        4: { cellWidth: 25 },
        5: { cellWidth: 'auto' },
      }
    });

    y = (doc as any).lastAutoTable.finalY + 8;
    
    doc.setFontSize(8);
    doc.setTextColor(100);
    const signatureText = `Declaro ter recebido a importância líquida descrita neste recibo, correspondente aos meus serviços prestados na competência mencionada.`;
    doc.text(signatureText, pageWidth / 2, y, { align: 'center', maxWidth: pageWidth - 80 });
    y += 10;
    
    doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
    doc.text('Assinatura do Funcionário(a)', pageWidth / 2, y + 4, { align: 'center' });
    
    return y + 10;
  };

  addHeader(doc, company);
  
  const firstCopyEndY = drawPayslip(50);
  
  doc.setLineDashPattern([2, 2], 0);
  doc.line(10, firstCopyEndY, pageWidth - 10, firstCopyEndY);
  doc.setLineDashPattern([], 0);

  drawPayslip(firstCopyEndY + 10);
  
  doc.output('dataurlnewwindow');
}
