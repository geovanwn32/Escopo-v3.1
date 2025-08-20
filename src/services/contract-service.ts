
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj?: string): string => {
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

const formatCpf = (cpf?: string): string => {
    if (!cpf) return '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

const formatDate = (date: Date | undefined): string => {
    if (!date) return '';
    return format(date, 'dd/MM/yyyy');
}

const writeClause = (doc: jsPDF, y: number, title: string, content: string): number => {
    let currentY = y;
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, currentY);
    currentY += 6;
    doc.setFont('helvetica', 'normal');
    const splitContent = doc.splitTextToSize(content, 182);
    doc.text(splitContent, 14, currentY);
    currentY += doc.getTextDimensions(splitContent).h + 6;
    return currentY;
};


export function generateContractPdf(company: Company, employee: Employee) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let y = 15;

  // --- HEADER ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATO INDIVIDUAL DE TRABALHO', pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // --- PARTIES ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('IDENTIFICAÇÃO DAS PARTES', 14, y);
  y += 5;
  const companyAddress = `${company.logradouro || ''}, ${company.numero || 'S/N'}${company.complemento ? ` - ${company.complemento}` : ''}, ${company.bairro || ''}, ${company.cidade || ''} - ${company.uf || ''}`;

  autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      head: [
          [{ content: 'EMPREGADOR', colSpan: 2, styles: { fillColor: [240, 245, 255], textColor: 30, fontStyle: 'bold' } }]
      ],
      body: [
          [{ content: 'Razão Social:', styles: { fontStyle: 'bold' } }, company.razaoSocial],
          [{ content: 'CNPJ:', styles: { fontStyle: 'bold' } }, formatCnpj(company.cnpj)],
          [{ content: 'Endereço:', styles: { fontStyle: 'bold' } }, companyAddress],
          [{ content: 'Telefone:', styles: { fontStyle: 'bold' } }, company.telefone || ''],
      ],
      columnStyles: { 0: { cellWidth: 40 } }
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      head: [
          [{ content: 'EMPREGADO(A)', colSpan: 2, styles: { fillColor: [240, 245, 255], textColor: 30, fontStyle: 'bold' } }]
      ],
      body: [
          [{ content: 'Nome:', styles: { fontStyle: 'bold' } }, employee.nomeCompleto],
          [{ content: 'RG / CPF:', styles: { fontStyle: 'bold' } }, `${employee.rg} / ${formatCpf(employee.cpf)}`],
          [{ content: 'Endereço:', styles: { fontStyle: 'bold' } }, `${employee.logradouro}, ${employee.numero}, ${employee.bairro}, ${employee.cidade} - ${employee.uf}`],
      ],
      columnStyles: { 0: { cellWidth: 40 } }
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFontSize(10);

  y = writeClause(doc, y, 'CLÁUSULA PRIMEIRA - DO OBJETO', 
    `O presente contrato tem por objeto a prestação de trabalho pelo(a) EMPREGADO(A) ao EMPREGADOR, exercendo a função de ${employee.cargo}, obrigando-se a realizar todas as tarefas inerentes ao cargo para o qual foi contratado(a).`
  );
  
  y = writeClause(doc, y, 'CLÁUSULA SEGUNDA - DA JORNADA DE TRABALHO', 
    `A jornada de trabalho do(a) EMPREGADO(A) será de ${employee.jornadaTrabalho}, com os respectivos intervalos para repouso e alimentação, conforme a legislação vigente.`
  );

  y = writeClause(doc, y, 'CLÁUSULA TERCEIRA - DA REMUNERAÇÃO', 
    `Pela prestação dos serviços, o(a) EMPREGADO(A) receberá o salário mensal de ${formatCurrency(employee.salarioBase)}, a ser pago até o 5º (quinto) dia útil do mês subsequente ao vencido.`
  );

  y = writeClause(doc, y, 'CLÁUSULA QUARTA - DO PRAZO DO CONTRATO', 
    `O presente contrato é celebrado a título de experiência pelo prazo de 45 (quarenta e cinco) dias, a contar da data de admissão em ${formatDate(employee.dataAdmissao)}, podendo ser prorrogado por igual período, findo o qual, se não houver manifestação em contrário, passará a vigorar por prazo indeterminado.`
  );
  
  y = writeClause(doc, y, 'CLÁUSULA QUINTA - DAS DISPOSIÇÕES GERAIS',
    `O(A) EMPREGADO(A) declara estar ciente e de acordo com as normas e regulamentos internos da empresa. As partes reger-se-ão pela Consolidação das Leis do Trabalho (CLT) e demais legislações aplicáveis.`
  );

  y = Math.max(y, 240); // Move to bottom for signatures

  // --- SIGNATURES ---
  const city = company.cidade || " ";
  const today = new Date();
  doc.setFontSize(10);
  doc.text(`${city}, ${format(today, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.line(25, y, 95, y);
  doc.text('EMPREGADOR', 60, y + 4, { align: 'center' });
  
  doc.line(pageWidth - 95, y, pageWidth - 25, y);
  doc.text('EMPREGADO(A)', pageWidth - 60, y + 4, { align: 'center' });
  
  // Open the PDF in a new tab
  doc.output('dataurlnewwindow');
}
