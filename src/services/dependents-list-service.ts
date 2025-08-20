
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
import { format } from 'date-fns';

const formatCnpj = (cnpj: string): string => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

const formatDate = (date: Date | undefined): string => {
    if (!date) return '';
    // Firestore Timestamps are converted to Date objects, which might be null.
    try {
        const jsDate = (date as any).toDate ? (date as any).toDate() : date;
        return format(jsDate, 'dd/MM/yyyy');
    } catch {
        return 'Data inválida';
    }
}

const formatCpf = (cpf?: string): string => {
    if (!cpf) return '';
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

export function generateDependentsListPdf(company: Company, employee: Employee) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let y = addHeader(doc, company);

  // --- TITLE ---
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Relação de Dependentes', pageWidth / 2, y, { align: 'center' });
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
    ],
    columnStyles: { 
        0: { cellWidth: 35 }, 
    }
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // --- DEPENDENTS LIST ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Dependentes Cadastrados', 14, y);
  y += 5;
  
  if (!employee.dependentes || employee.dependentes.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Nenhum dependente cadastrado para este funcionário.', 14, y);
  } else {
    const tableRows = employee.dependentes.map(dep => [
        dep.nomeCompleto,
        formatDate(dep.dataNascimento),
        formatCpf(dep.cpf),
        dep.isSalarioFamilia ? 'Sim' : 'Não',
        dep.isIRRF ? 'Sim' : 'Não'
      ]);
    
    autoTable(doc, {
        startY: y,
        head: [['Nome Completo', 'Data Nasc.', 'CPF', 'Sal. Família', 'IRRF']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 30, halign: 'center' },
            3: { cellWidth: 22, halign: 'center' },
            4: { cellWidth: 15, halign: 'center' },
        }
    });
  }
  
  // --- SIGNATURES ---
  y = (doc as any).lastAutoTable.finalY || y + 10;
  y = Math.max(y + 20, 250); // a safe limit to avoid going off page

  const city = company.cidade || " ";
  const today = new Date();
  doc.setFontSize(10);
  doc.text(`${city}, ${format(today, "d 'de' MMMM 'de' yyyy")}.`, pageWidth / 2, y, { align: 'center' });
  y += 15;
  
  doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
  doc.text('Assinatura do Empregado(a)', pageWidth / 2, y + 4, { align: 'center' });
  

  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
