
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

interface AggregatedData {
    employeeName: string;
    totalProventos: number;
    totalDescontos: number;
    totalLiquido: number;
}

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

export async function generatePayrollSummaryPdf(userId: string, company: Company, period: Period) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 15;
    
    // --- FETCH DATA ---
    const startDate = new Date(period.year, period.month - 1, 1);
    const endDate = new Date(period.year, period.month, 0, 23, 59, 59);
    
    const fetchCollection = async (collectionName: string, dateField: string) => {
        const ref = collection(db, `users/${userId}/companies/${company.id}/${collectionName}`);
        let q;
        if (collectionName === 'payrolls') { // Payrolls use 'period' which is a string "MM/YYYY"
             q = query(ref, where('period', '==', `${String(period.month).padStart(2, '0')}/${period.year}`));
        } else {
             q = query(ref, where(dateField, '>=', startDate), where(dateField, '<=', endDate));
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
    
    // --- AGGREGATE DATA ---
    const employeeTotals: { [employeeId: string]: AggregatedData } = {};

    const processItem = (item: any) => {
        const employeeId = item.employeeId;
        if (!employeeTotals[employeeId]) {
            employeeTotals[employeeId] = {
                employeeName: item.employeeName,
                totalProventos: 0,
                totalDescontos: 0,
                totalLiquido: 0,
            };
        }
        const totals = item.totals || item.result;
        employeeTotals[employeeId].totalProventos += totals.totalProventos || 0;
        employeeTotals[employeeId].totalDescontos += totals.totalDescontos || 0;
        employeeTotals[employeeId].totalLiquido += totals.liquido || 0;
    };

    allItems.forEach(processItem);

    // --- PDF GENERATION ---
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Resumo da Folha - ${String(period.month).padStart(2, '0')}/${period.year}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);
    doc.text(`${company.razaoSocial} - CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // --- MAIN TABLE ---
    const tableBody = Object.values(employeeTotals).map(data => [
        data.employeeName,
        formatCurrency(data.totalProventos),
        formatCurrency(data.totalDescontos),
        formatCurrency(data.totalLiquido)
    ]);
    
    const grandTotalProventos = Object.values(employeeTotals).reduce((sum, data) => sum + data.totalProventos, 0);
    const grandTotalDescontos = Object.values(employeeTotals).reduce((sum, data) => sum + data.totalDescontos, 0);
    const grandTotalLiquido = Object.values(employeeTotals).reduce((sum, data) => sum + data.totalLiquido, 0);
    
    tableBody.push([
        { content: 'TOTAIS GERAIS', styles: { fontStyle: 'bold', fillColor: [240, 245, 255] } },
        { content: formatCurrency(grandTotalProventos), styles: { fontStyle: 'bold', fillColor: [240, 245, 255] } },
        { content: formatCurrency(grandTotalDescontos), styles: { fontStyle: 'bold', fillColor: [240, 245, 255] } },
        { content: formatCurrency(grandTotalLiquido), styles: { fontStyle: 'bold', fillColor: [240, 245, 255] } },
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Funcionário', 'Total Proventos', 'Total Descontos', 'Total Líquido']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
        }
    });
    y = (doc as any).lastAutoTable.finalY + 15;
    
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
