
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';
import type { Socio } from '@/types/socio';
import type { RCI } from '@/types/rci';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
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

export function generateProLaboreReceiptPdf(company: Company, socio: Socio, rci: RCI) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const primaryColor = [51, 145, 255]; // #3391FF
  const destructiveColor = [220, 38, 38];

  const drawReceipt = (startY: number) => {
    let y = startY;

    // --- TITLE ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Recibo de Pagamento de Pró-labore', pageWidth / 2, y + 3, { align: 'center' });
    y += 10;
    
    // --- COMPANY & SOCIO INFO ---
    const socioBody = [
      [
        { content: 'Nome:', styles: { fontStyle: 'bold' } },
        { content: socio.nomeCompleto },
      ],
      [
        { content: 'CPF:', styles: { fontStyle: 'bold' } },
        { content: socio.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") },
      ],
    ];

    if (socio.nis) {
      socioBody.push([
        { content: 'NIT/PIS:', styles: { fontStyle: 'bold' } },
        { content: socio.nis },
      ]);
    }
    
    socioBody.push([
        { content: 'Competência:', styles: { fontStyle: 'bold' } },
        { content: rci.period },
    ]);


    autoTable(doc, {
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
        head: [
            [{ content: 'Sócio(a)', colSpan: 2, styles: { fillColor: [240, 245, 255], textColor: 30, fontStyle: 'bold' } }]
        ],
        body: socioBody,
        columnStyles: { 
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto' },
        }
    });
    y = (doc as any).lastAutoTable.finalY + 5;
    
    // --- EVENTS TABLE ---
    const tableRows = rci.events.map(event => {
        const proventoValue = event.provento ? event.provento.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
        const descontoValue = event.desconto ? event.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';

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

    // --- TOTALS ---
     autoTable(doc, {
        startY: y,
        theme: 'grid',
        showHead: false,
        styles: { fontSize: 8, cellPadding: 1.5, fontStyle: 'bold' },
        body: [
             [
                { content: 'Total de Proventos:', styles: { halign: 'right' } },
                { content: formatCurrency(rci.totals.totalProventos), styles: { halign: 'right' } },
                { content: 'Total de Descontos:', styles: { halign: 'right' } },
                { content: formatCurrency(rci.totals.totalDescontos), styles: { halign: 'right', textColor: destructiveColor } },
            ],
             [
                { content: '', colSpan: 2 },
                { content: 'LÍQUIDO A RECEBER:', styles: { halign: 'right', fillColor: [240, 245, 255] } },
                { content: formatCurrency(rci.totals.liquido), styles: { halign: 'right', fillColor: [240, 245, 255], textColor: primaryColor } },
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
    const signatureText = `Declaro ter recebido a importância líquida descrita neste recibo, correspondente à minha retirada de pró-labore na competência mencionada.`;
    doc.text(signatureText, pageWidth / 2, y, { align: 'center', maxWidth: pageWidth - 80 });
    y += 8;
    
    doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
    doc.text('Assinatura do Sócio(a)', pageWidth / 2, y + 4, { align: 'center' });
    
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
