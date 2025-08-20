
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
import type { Thirteenth } from '@/types/thirteenth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

const formatDate = (date: Date | undefined): string => {
    if (!date) return '';
    return format(date, 'dd/MM/yyyy');
}

const getParcelLabel = (parcel: string): string => {
    switch(parcel) {
        case 'first': return '1ª Parcela';
        case 'second': return '2ª Parcela';
        case 'unique': return 'Parcela Única';
        default: return parcel;
    }
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

export function generateThirteenthReceiptPdf(company: Company, employee: Employee, thirteenth: Thirteenth) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const primaryColor = [51, 145, 255]; // #3391FF
  const destructiveColor = [220, 38, 38];

  const drawReceipt = (startY: number) => {
    let y = startY;

    // --- TITLE ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Recibo de Pagamento - 13º Salário`, pageWidth / 2, y + 3, { align: 'center' });
    y += 10;
    
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
                { content: 'Referência:', styles: { fontStyle: 'bold' } },
                { content: `${getParcelLabel(thirteenth.parcel)} - ${thirteenth.year}` },
            ],
        ],
        columnStyles: { 
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto' },
        }
    });
    y = (doc as any).lastAutoTable.finalY + 5;
    
    // --- PAYROLL EVENTS TABLE (Vertical Layout) ---
    const tableRows = thirteenth.result.events.map(event => {
        const proventoValue = event.provento ? event.provento.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
        const descontoValue = event.desconto ? event.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
        return [
            event.descricao,
            event.referencia,
            proventoValue,
            descontoValue,
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['Descrição', 'Referência', 'Proventos', 'Descontos']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 20, halign: 'right' },
            2: { cellWidth: 25, halign: 'right' },
            3: { cellWidth: 25, halign: 'right' },
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
                { content: formatCurrency(thirteenth.result.totalProventos), styles: { halign: 'right' } },
                { content: 'Total de Descontos:', styles: { halign: 'right' } },
                { content: formatCurrency(thirteenth.result.totalDescontos), styles: { halign: 'right', textColor: destructiveColor } },
            ],
             [
                { content: '', colSpan: 2 },
                { content: 'LÍQUIDO A RECEBER:', styles: { halign: 'right', fillColor: [240, 245, 255] } },
                { content: formatCurrency(thirteenth.result.liquido), styles: { halign: 'right', fillColor: [240, 245, 255], textColor: primaryColor } },
            ],
        ],
        columnStyles: {
            0: { cellWidth: 'auto' }, 
            1: { cellWidth: 25 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 25 },
        }
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    
    doc.setFontSize(8);
    doc.setTextColor(100);
    const signatureText = `Declaro ter recebido a importância líquida descrita neste recibo.`;
    doc.text(signatureText, 14, y, { maxWidth: pageWidth - 28 });
    y += 8;
    
    doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
    doc.text('Assinatura do Funcionário(a)', pageWidth / 2, y + 4, { align: 'center' });
    
    return y + 10;
  };

  addHeader(doc, company);

  // Draw first copy
  const firstCopyEndY = drawReceipt(50);
  
  // Draw separator
  doc.setLineDashPattern([2, 2], 0);
  doc.line(10, firstCopyEndY, pageWidth - 10, firstCopyEndY);
  doc.setLineDashPattern([], 0);

  // Draw second copy
  drawReceipt(firstCopyEndY + 5);

  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
