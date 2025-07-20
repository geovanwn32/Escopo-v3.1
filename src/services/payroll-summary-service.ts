
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Payroll } from '@/types/payroll';
import type { Termination } from '@/types/termination';
import type { Thirteenth } from '@/types/thirteenth';
import type { Vacation } from '@/types/vacation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Period {
    month: number;
    year: number;
}

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const getEventName = (item: any): string => {
    if (item.period) return `Folha de Pagamento - ${item.period}`;
    if (item.vacationDays) {
        const startDate = (item.startDate as any)?.toDate ? (item.startDate as any).toDate() : item.startDate;
        return `Férias - Início em ${format(startDate, 'dd/MM/yyyy')}`;
    }
    if (item.parcel) {
        const parcelLabel = { first: '1ª Parcela', second: '2ª Parcela', unique: 'Parcela Única' }[item.parcel] || item.parcel;
        return `13º Salário (${parcelLabel}) - ${item.year}`;
    }
    if (item.reason) {
        const termDate = (item.terminationDate as any)?.toDate ? (item.terminationDate as any).toDate() : item.terminationDate;
        return `Rescisão - ${format(termDate, 'dd/MM/yyyy')}`;
    }
    return 'Lançamento';
};


export async function generatePayrollSummaryPdf(userId: string, company: Company, period: Period) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 15;
    const primaryColor = [51, 145, 255]; // #3391FF

    // --- FETCH DATA ---
    const startDate = new Date(period.year, period.month - 1, 1);
    const endDate = new Date(period.year, period.month, 0, 23, 59, 59);

    const fetchCollection = async (collectionName: string, dateField: string) => {
        const ref = collection(db, `users/${userId}/companies/${company.id}/${collectionName}`);
        let q;
        if (collectionName === 'payrolls') {
             q = query(ref, where('period', '==', `${String(period.month).padStart(2, '0')}/${period.year}`));
        } else {
             q = query(ref, where(dateField, '>=', Timestamp.fromDate(startDate)), where(dateField, '<=', Timestamp.fromDate(endDate)));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const payrolls = await fetchCollection('payrolls', 'createdAt') as Payroll[];
    const vacations = await fetchCollection('vacations', 'startDate') as Vacation[];
    const thirteenths = await fetchCollection('thirteenths', 'createdAt') as Thirteenth[];
    const terminations = await fetchCollection('terminations', 'terminationDate') as Termination[];

    const allItems = [...payrolls, ...vacations, ...thirteenths, ...terminations];
    if (allItems.length === 0) {
        throw new Error("Nenhum lançamento encontrado para o período selecionado.");
    }
    
    // Group items by employee
    const itemsByEmployee: { [employeeId: string]: any[] } = {};
    allItems.forEach(item => {
        if (!itemsByEmployee[item.employeeId]) {
            itemsByEmployee[item.employeeId] = [];
        }
        itemsByEmployee[item.employeeId].push(item);
    });

    // --- PDF GENERATION ---
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Relatório Detalhado da Folha - ${String(period.month).padStart(2, '0')}/${period.year}`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const companyAddress = `${company.logradouro || ''}, ${company.numero || ''} - ${company.bairro || ''}, ${company.cidade || ''} - ${company.uf || ''}`;
    doc.text(`${company.razaoSocial} | CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(companyAddress, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    let grandTotalProventos = 0;
    let grandTotalDescontos = 0;
    let grandTotalLiquido = 0;

    for (const employeeId in itemsByEmployee) {
        const employeeItems = itemsByEmployee[employeeId];
        const employeeName = employeeItems[0].employeeName;
        
        let employeeTotalProventos = 0;
        let employeeTotalDescontos = 0;
        
        if (y > 240) { // Check if new section fits, if not, new page
          doc.addPage();
          y = 15;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Funcionário: ${employeeName}`, 14, y);
        y += 6;

        for (const item of employeeItems) {
            const totals = item.totals || item.result;
            const events = item.events || item.result?.events || [];
            
            if (y > 250) { // Check before drawing each table
              doc.addPage();
              y = 15;
            }
            
            // Table for each event type
            autoTable(doc, {
                startY: y,
                head: [[{ content: getEventName(item), colSpan: 4, styles: { fillColor: [220, 220, 220], textColor: 30 } }]],
                body: events.map((ev: any) => [ev.descricao, ev.referencia, formatCurrency(ev.provento), formatCurrency(ev.desconto)]),
                foot: [[
                  { content: 'Subtotal', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
                  { content: formatCurrency(totals.totalProventos), styles: { halign: 'right', fontStyle: 'bold' } },
                  { content: formatCurrency(totals.totalDescontos), styles: { halign: 'right', fontStyle: 'bold' } },
                ]],
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fontStyle: 'bold' },
                footStyles: { fillColor: [245, 245, 245] },
                columnStyles: {
                  0: { cellWidth: 'auto' },
                  1: { cellWidth: 25, halign: 'right' },
                  2: { cellWidth: 30, halign: 'right' },
                  3: { cellWidth: 30, halign: 'right' },
                }
            });
            y = (doc as any).lastAutoTable.finalY + 5;
            
            employeeTotalProventos += totals.totalProventos || 0;
            employeeTotalDescontos += totals.totalDescontos || 0;
        }
        
        // Employee Total Summary Table
        const employeeTotalLiquido = employeeTotalProventos - employeeTotalDescontos;
        grandTotalProventos += employeeTotalProventos;
        grandTotalDescontos += employeeTotalDescontos;
        grandTotalLiquido += employeeTotalLiquido;

        autoTable(doc, {
            startY: y,
            theme: 'grid',
            head: [[`Resumo do Funcionário - ${employeeName}`]],
            headStyles: { fillColor: primaryColor, textColor: 255 },
            body: [
                ['Total de Proventos', formatCurrency(employeeTotalProventos)],
                ['Total de Descontos', formatCurrency(employeeTotalDescontos)],
                [{ content: 'Total Líquido', styles: { fontStyle: 'bold' } }, { content: formatCurrency(employeeTotalLiquido), styles: { fontStyle: 'bold' } }],
            ],
            styles: { fontSize: 9, fontStyle: 'bold' },
            columnStyles: { 0: { halign: 'right' }, 1: { halign: 'right' } }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // --- GRAND TOTALS PAGE ---
    if (Object.keys(itemsByEmployee).length > 1) { // Only add summary page if more than one employee
        doc.addPage();
        y = 15;
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`Resumo Geral da Folha - ${String(period.month).padStart(2, '0')}/${period.year}`, pageWidth / 2, y, { align: 'center' });
        y += 15;
        
        autoTable(doc, {
          startY: y,
          head: [['Descrição', 'Valor']],
          body: [
            ['Total Geral de Proventos', formatCurrency(grandTotalProventos)],
            ['Total Geral de Descontos', formatCurrency(grandTotalDescontos)],
            [{ content: 'Total Líquido Geral', styles: { fontStyle: 'bold' } }, { content: formatCurrency(grandTotalLiquido), styles: { fontStyle: 'bold' } }],
          ],
          theme: 'grid',
          headStyles: { fillColor: [50, 50, 50], textColor: 255 },
          styles: { fontSize: 10 },
          columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' } }
        });
        y = (doc as any).lastAutoTable.finalY + 15;
    }


    // Legal Basis
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Embasamento Legal', 14, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const legalText = `Este relatório é um resumo gerencial dos lançamentos de folha de pagamento para o período de competência e não substitui os documentos legais individuais (holerites, recibos de férias, TRCT), que devem ser emitidos e assinados em conformidade com a Consolidação das Leis do Trabalho (CLT) e demais legislações aplicáveis. Os valores aqui apresentados servem como base para a apuração de guias de recolhimento de impostos e contribuições como FGTS, INSS e IRRF.`;
    doc.text(legalText, 14, y, { maxWidth: pageWidth - 28, lineHeightFactor: 1.5 });
    
    // Open the PDF
    doc.output('dataurlnewwindow');
}
