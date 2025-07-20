
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
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

interface AggregatedData {
    [employeeId: string]: {
        employeeName: string;
        payrolls: Payroll[];
        vacations: Vacation[];
        thirteenths: Thirteenth[];
        terminations: Termination[];
    }
}

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const formatDate = (date: any): string => {
    if (!date) return '';
    try {
        const jsDate = (date as Timestamp).toDate ? (date as Timestamp).toDate() : date;
        return format(jsDate, 'dd/MM/yyyy', { locale: ptBR });
    } catch {
        return 'Data inválida';
    }
}

export async function generatePayrollSummaryPdf(userId: string, company: Company, period: Period) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 15;
    const primaryColor = [51, 145, 255]; // #3391FF
    
    // --- FETCH DATA ---
    const startDate = new Date(period.year, period.month - 1, 1);
    const endDate = new Date(period.year, period.month, 0, 23, 59, 59);

    const fetchData = async (collectionName: string, dateField: string) => {
        const ref = collection(db, `users/${userId}/companies/${company.id}/${collectionName}`);
        const q = query(ref, where(dateField, '>=', startDate), where(dateField, '<=', endDate));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const payrolls = await fetchData('payrolls', 'createdAt') as Payroll[];
    const vacations = await fetchData('vacations', 'startDate') as Vacation[];
    const thirteenths = await fetchData('thirteenths', 'createdAt') as Thirteenth[];
    const terminations = await fetchData('terminations', 'terminationDate') as Termination[];

    const allData = [...payrolls, ...vacations, ...thirteenths, ...terminations];
    if (allData.length === 0) {
        throw new Error("Nenhum lançamento encontrado para o período selecionado.");
    }
    
    // --- AGGREGATE DATA ---
    const aggregatedData: AggregatedData = {};
    const processItem = (item: any, type: keyof AggregatedData[string]) => {
        if (!aggregatedData[item.employeeId]) {
            aggregatedData[item.employeeId] = {
                employeeName: item.employeeName,
                payrolls: [], vacations: [], thirteenths: [], terminations: []
            };
        }
        (aggregatedData[item.employeeId][type] as any[]).push(item);
    };

    payrolls.forEach(p => processItem(p, 'payrolls'));
    vacations.forEach(v => processItem(v, 'vacations'));
    thirteenths.forEach(t => processItem(t, 'thirteenths'));
    terminations.forEach(t => processItem(t, 'terminations'));

    // --- PDF GENERATION ---
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Resumo da Folha - ${String(period.month).padStart(2, '0')}/${period.year}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);
    doc.text(`${company.razaoSocial} - CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    let grandTotalProventos = 0;
    let grandTotalDescontos = 0;

    // Loop through each employee
    for (const employeeId in aggregatedData) {
        const data = aggregatedData[employeeId];
        let employeeTotalProventos = 0;
        let employeeTotalDescontos = 0;

        doc.addPage();
        y = 15;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Funcionário(a): ${data.employeeName}`, 14, y);
        y += 8;

        const drawSection = (title: string, items: any[], eventField: string, totalField: string, dateField: string, dateLabel: string) => {
            if (items.length > 0) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 14, y);
                y += 5;

                items.forEach(item => {
                    autoTable(doc, {
                        startY: y,
                        head: [[dateLabel, formatDate(item[dateField])]],
                        headStyles: { fillColor: [240, 245, 255], textColor: 30 },
                        theme: 'grid',
                    });
                     y = (doc as any).lastAutoTable.finalY;

                    const events = item[eventField] || item.result.events;
                    const totals = item[totalField] || item.result;
                    
                    const tableRows = events.map((e: any) => [e.descricao, e.referencia, formatCurrency(e.provento), formatCurrency(e.desconto)]);
                    autoTable(doc, {
                        startY: y,
                        head: [['Verba', 'Referência', 'Proventos', 'Descontos']],
                        body: tableRows,
                        theme: 'striped',
                        headStyles: { fillColor: [220, 220, 220], textColor: 0, fontSize: 9 },
                        styles: { fontSize: 8 }
                    });
                     y = (doc as any).lastAutoTable.finalY;

                    autoTable(doc, {
                        startY: y,
                        body: [[
                            { content: `Total ${title}: ${formatCurrency(totals.liquido)}`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } }
                        ]],
                        theme: 'grid'
                    });
                    y = (doc as any).lastAutoTable.finalY + 5;
                    
                    employeeTotalProventos += totals.totalProventos || 0;
                    employeeTotalDescontos += totals.totalDescontos || 0;
                });
            }
        };

        drawSection('Folha de Pagamento', data.payrolls, 'events', 'totals', 'createdAt', 'Data do Cálculo');
        drawSection('Férias', data.vacations, 'result.events', 'result', 'startDate', 'Início das Férias');
        drawSection('13º Salário', data.thirteenths, 'result.events', 'result', 'createdAt', 'Data do Cálculo');
        drawSection('Rescisão', data.terminations, 'result.events', 'result', 'terminationDate', 'Data da Rescisão');

        // Employee Totals
        const employeeLiquido = employeeTotalProventos - employeeTotalDescontos;
        autoTable(doc, {
            startY: y,
            theme: 'grid',
            head: [[`Resumo do Funcionário - ${data.employeeName}`]],
            headStyles: { fillColor: primaryColor, textColor: 255 },
            body: [
                ['Total de Proventos', formatCurrency(employeeTotalProventos)],
                ['Total de Descontos', formatCurrency(employeeTotalDescontos)],
                [{ content: 'Total Líquido', styles: { fontStyle: 'bold' } }, { content: formatCurrency(employeeLiquido), styles: { fontStyle: 'bold' } }],
            ]
        });
        y = (doc as any).lastAutoTable.finalY + 10;
        
        grandTotalProventos += employeeTotalProventos;
        grandTotalDescontos += employeeTotalDescontos;
    }

    // --- GRAND TOTALS & LEGAL ---
    doc.deletePage(1); // Remove the initial blank page
    doc.addPage();
    y = 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Resumo Geral da Folha - ${String(period.month).padStart(2, '0')}/${period.year}`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    const grandTotalLiquido = grandTotalProventos - grandTotalDescontos;
    autoTable(doc, {
        startY: y,
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50], textColor: 255 },
        head: [['Descrição', 'Valor']],
        body: [
            ['Total Geral de Proventos', formatCurrency(grandTotalProventos)],
            ['Total Geral de Descontos', formatCurrency(grandTotalDescontos)],
            [{ content: 'Total Líquido da Folha', styles: { fontStyle: 'bold' } }, { content: formatCurrency(grandTotalLiquido), styles: { fontStyle: 'bold' } }],
        ]
    });
    y = (doc as any).lastAutoTable.finalY + 10;

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
