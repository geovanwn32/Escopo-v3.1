
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';
import type { Partner } from '@/types/partner';
import type { Orcamento } from '@/types/orcamento';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj?: string): string => {
    if (!cnpj) return '';
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
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

export function generateQuotePdf(company: Company, partner: Partner, quoteData: Orcamento) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let y = addHeader(doc, company);

  // --- QUOTE NUMBER ---
  const quoteNumberText = `Nº ${String(quoteData.quoteNumber).padStart(4, '0')}`;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(quoteNumberText, pageWidth - 14, y, { align: 'right' });
  y += 2;

  // --- TITLE ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', pageWidth / 2, y, { align: 'center' });
  const titleWidth = doc.getTextWidth('ORÇAMENTO');
  doc.setLineWidth(0.5);
  doc.line(pageWidth/2 - titleWidth/2, y + 1, pageWidth/2 + titleWidth/2, y + 1);
  y += 10;
  
  // --- BODY TEXT ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  let text = `Empresa com o nome fantasia: ${partner.nomeFantasia || partner.razaoSocial}, com o nome razão social: ${partner.razaoSocial}, inscrita no cadastro do CNPJ sob o nº ${formatCnpj(partner.cpfCnpj)}, situada a ${partner.logradouro || '[Rua]'}, ${partner.numero || '[Nº]'}, ${partner.bairro || '[Bairro]'}, ${partner.cidade || '[Cidade]'} - ${partner.uf || '[UF]'}, CEP: ${partner.cep || '[CEP]'}.`;
  let splitText = doc.splitTextToSize(text, 182);
  doc.text(splitText, 14, y);
  y += doc.getTextDimensions(splitText).h + 6;

  text = `O presente documento tem por finalidade formalizar a emissão de orçamento detalhado, conforme descrito a seguir, contemplando as solicitações específicas e a concordância expressa com a prestação dos serviços a serem executados nas dependências da obra, de acordo com a lista de materiais a serem utilizados e os serviços correspondentes.`;
  splitText = doc.splitTextToSize(text, 182);
  doc.text(splitText, 14, y);
  y += doc.getTextDimensions(splitText).h + 6;

  text = `Em razão da aceitação do presente orçamento, e uma vez concluídos e finalizados os serviços contratados, o prestador de serviços compromete-se a:`;
  splitText = doc.splitTextToSize(text, 182);
  doc.text(splitText, 14, y);
  y += doc.getTextDimensions(splitText).h + 4;
  
  doc.text('•', 20, y);
  text = `Emitir a respectiva Nota Fiscal, incluindo no valor total os materiais empregados na execução do serviço, conforme previamente acordado entre as partes.`;
  splitText = doc.splitTextToSize(text, 172);
  doc.text(splitText, 24, y);
  y += doc.getTextDimensions(splitText).h + 8;
  
  // --- TABLES ---
  const products = quoteData.items.filter(item => item.type === 'produto');
  const services = quoteData.items.filter(item => item.type === 'servico');

  let totalProdutos = 0;
  if (products.length > 0) {
    totalProdutos = products.reduce((acc, item) => acc + item.total, 0);
    const productRows = products.map(item => [
      item.description,
      item.quantity.toLocaleString('pt-BR'),
      formatCurrency(item.unitPrice),
      formatCurrency(item.total)
    ]);
    
    autoTable(doc, {
      startY: y,
      head: [['PRODUTO (MATERIAL)', 'QUANTIDADE', 'VALOR UNITÁRIO', 'VALOR TOTAL']],
      body: productRows,
      foot: [[{ content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(totalProdutos), styles: { halign: 'right', fontStyle: 'bold' } }]],
      theme: 'grid',
      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2, lineColor: 150, lineWidth: 0.1 },
      columnStyles: { 0: {cellWidth: 'auto'}, 1: {cellWidth: 30, halign: 'right'}, 2: {cellWidth: 35, halign: 'right'}, 3: {cellWidth: 35, halign: 'right'} },
    });
    y = (doc as any).lastAutoTable.finalY;
  }

  let totalServicos = 0;
  if (services.length > 0) {
    totalServicos = services.reduce((acc, item) => acc + item.total, 0);
    const serviceRows = services.map(item => [
      item.itemLc || '-',
      item.description,
      item.quantity.toLocaleString('pt-BR'),
      formatCurrency(item.unitPrice),
      formatCurrency(item.total)
    ]);
    
    autoTable(doc, {
      startY: y,
      head: [['ITEM LC', 'SERVIÇO (DESCRIÇÃO)', 'QUANTIDADE', 'VALOR UNITÁRIO', 'VALOR TOTAL']],
      body: serviceRows,
      foot: [[{ content: 'TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(totalServicos), styles: { halign: 'right', fontStyle: 'bold' } }]],
      theme: 'grid',
      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2, lineColor: 150, lineWidth: 0.1 },
      columnStyles: { 0: {cellWidth: 20}, 1: {cellWidth: 'auto'}, 2: {cellWidth: 25, halign: 'right'}, 3: {cellWidth: 30, halign: 'right'}, 4: {cellWidth: 30, halign: 'right'} },
    });
    y = (doc as any).lastAutoTable.finalY;
  }
  
  // --- GRAND TOTAL ---
  const grandTotal = totalProdutos + totalServicos;
  autoTable(doc, {
      startY: y,
      body: [[{ content: 'TOTAL', styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(grandTotal), styles: { fontStyle: 'bold', halign: 'right' } }]],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, lineColor: 150, lineWidth: 0.1 }
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  
  
  // --- FOOTER ---
  doc.setFontSize(9);
  doc.text('Orçamento tem um prazo de 30 dias.', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.text(`${company.cidade || ''} - ${company.uf || ''}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, pageWidth / 2, y, { align: 'center' });
  y += 15;
  
  doc.line(pageWidth/2 - 40, y, pageWidth/2 + 40, y);
  y += 4;
  doc.setFontSize(10);
  doc.text(company.nomeFantasia.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(8);
  doc.text(`CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth / 2, y, { align: 'center' });

  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
