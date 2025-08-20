
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company, Launch } from '@/app/(app)/fiscal/page';
import { format } from 'date-fns';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
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

const formatDate = (date: any): string => {
    if (!date) return '';
    try {
        const jsDate = date.toDate ? date.toDate() : new Date(date);
        if (isNaN(jsDate.getTime())) return '';
        return format(jsDate, 'dd/MM/yyyy');
    } catch {
        return '';
    }
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

export function generateLaunchPdf(company: Company, launch: Launch) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let y = addHeader(doc, company);

  const isNFe = launch.type === 'entrada' || launch.type === 'saida';
  const title = isNFe ? 'Documento Auxiliar da Nota Fiscal Eletrônica' : 'Nota Fiscal de Serviços Eletrônica';
  const partnerRole = isNFe ? (launch.type === 'entrada' ? 'Emitente' : 'Destinatário') : 'Tomador do Serviço';
  const companyRole = isNFe ? (launch.type === 'entrada' ? 'Destinatário' : 'Emitente') : 'Prestador do Serviço';
  
  const partner = isNFe ? (launch.type === 'entrada' ? launch.emitente : launch.destinatario) : launch.tomador;
  const ourCompany = isNFe ? (launch.type === 'entrada' ? launch.destinatario : launch.emitente) : launch.prestador;


  // --- TITLE ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Documento: ${launch.chaveNfe || launch.numeroNfse || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text(`Data: ${formatDate(launch.date)}`, pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  // --- PARTIES ---
  autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      head: [
          [{ content: companyRole, colSpan: 2, styles: { fillColor: [240, 245, 255], textColor: 30, fontStyle: 'bold' } }]
      ],
      body: [
          [{ content: 'Nome/Razão Social:', styles: { fontStyle: 'bold' } }, ourCompany?.nome || company.razaoSocial],
          [{ content: 'CNPJ/CPF:', styles: { fontStyle: 'bold' } }, formatCnpj(ourCompany?.cnpj || company.cnpj)],
      ],
      columnStyles: { 0: { cellWidth: 40 } }
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      head: [
          [{ content: partnerRole, colSpan: 2, styles: { fillColor: [240, 245, 255], textColor: 30, fontStyle: 'bold' } }]
      ],
      body: [
          [{ content: 'Nome/Razão Social:', styles: { fontStyle: 'bold' } }, partner?.nome || 'Não identificado'],
          [{ content: 'CNPJ/CPF:', styles: { fontStyle: 'bold' } }, formatCnpj(partner?.cnpj)],
      ],
      columnStyles: { 0: { cellWidth: 40 } }
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  
  // --- DETAILS ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhes', 14, y);
  y += 5;

  if (isNFe) {
     const productRows = (launch.produtos || []).map(p => [
        p.codigo,
        p.descricao,
        p.cfop,
        formatCurrency(p.valorUnitario)
    ]);
     autoTable(doc, {
        startY: y,
        head: [['Cód.', 'Descrição do Produto', 'CFOP', 'Vlr. Unit.']],
        body: productRows,
        theme: 'grid'
     });
     y = (doc as any).lastAutoTable.finalY + 3;
     autoTable(doc, {
        startY: y,
        body: [[{content: 'Valor Total da Nota:', styles: {halign: 'right', fontStyle: 'bold'}}, {content: formatCurrency(launch.valorTotalNota), styles: {halign: 'right', fontStyle: 'bold'}}]]
     })

  } else { // NFS-e
     autoTable(doc, {
        startY: y,
        theme: 'plain',
        body: [
            ['Discriminação dos Serviços:', launch.discriminacao || '']
        ]
     });
     y = (doc as any).lastAutoTable.finalY + 5;
     const taxRows = [
        ['Valor dos Serviços', formatCurrency(launch.valorServicos)],
        ['PIS', formatCurrency(launch.valorPis)],
        ['COFINS', formatCurrency(launch.valorCofins)],
        ['CSLL', formatCurrency(launch.valorCsll)],
        ['INSS', formatCurrency(launch.valorInss)],
        ['IR', formatCurrency(launch.valorIr)],
     ]
     autoTable(doc, {
         startY: y,
         body: taxRows,
         theme: 'grid'
     })
      y = (doc as any).lastAutoTable.finalY + 1;
      autoTable(doc, {
        startY: y,
        body: [[{content: 'Valor Líquido:', styles: {halign: 'right', fontStyle: 'bold'}}, {content: formatCurrency(launch.valorLiquido), styles: {halign: 'right', fontStyle: 'bold'}}]]
     })
  }

  
  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
