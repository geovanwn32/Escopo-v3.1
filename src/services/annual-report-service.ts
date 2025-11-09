
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Launch } from '@/app/(app)/fiscal/page';
import { format, startOfYear, endOfYear, getMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
  if (!cnpj) return '';
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

function addHeader(doc: jsPDF, company: Company, year: number) {
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
    
    return y + 10;
}

export async function generateAnnualReportPdf(userId: string, company: Company, year: number): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = addHeader(doc, company, year);

    // --- 1. FETCH DATA ---
    const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
    const startDate = startOfYear(new Date(year, 0, 1));
    const endDate = endOfYear(new Date(year, 11, 31));

    const q = query(launchesRef,
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
    );

    const snapshot = await getDocs(q);
    const launches = snapshot.docs.map(doc => doc.data() as Launch);

    if (launches.length === 0) {
        throw new Error("Nenhum lançamento fiscal encontrado para o ano selecionado.");
    }

    // --- 2. PROCESS DATA ---
     const monthlyData: { 
        month: string; 
        faturamento: { total: number; normal: number; cancelado: number; substituida: number };
        custos: { total: number; normal: number; cancelado: number; substituida: number };
        saldo: number 
    }[] = Array.from({ length: 12 }, (_, i) => ({
        month: format(new Date(year, i, 1), 'MMMM', { locale: ptBR }),
        faturamento: { total: 0, normal: 0, cancelado: 0, substituida: 0 },
        custos: { total: 0, normal: 0, cancelado: 0, substituida: 0 },
        saldo: 0,
    }));

    launches.forEach(launch => {
        const launchDate = (launch.date as any).toDate ? (launch.date as any).toDate() : new Date(launch.date);
        const monthIndex = getMonth(launchDate);
        const value = launch.valorLiquido || launch.valorTotalNota || 0;
        const status = (launch.status || 'Normal').toLowerCase() as 'normal' | 'cancelado' | 'substituida';

        if (launch.type === 'saida' || launch.type === 'servico') {
            monthlyData[monthIndex].faturamento.total += value;
            if (status === 'normal') monthlyData[monthIndex].faturamento.normal += value;
            if (status === 'cancelado') monthlyData[monthIndex].faturamento.cancelado += value;
            if (status === 'substituida') monthlyData[monthIndex].faturamento.substituida += value;
        } else if (launch.type === 'entrada') {
             monthlyData[monthIndex].custos.total += value;
            if (status === 'normal') monthlyData[monthIndex].custos.normal += value;
            if (status === 'cancelado') monthlyData[monthIndex].custos.cancelado += value;
            if (status === 'substituida') monthlyData[monthIndex].custos.substituida += value;
        }
    });

    const totals = {
        faturamento: { total: 0, normal: 0, cancelado: 0, substituida: 0 },
        custos: { total: 0, normal: 0, cancelado: 0, substituida: 0 },
        saldo: 0
    };

    monthlyData.forEach(month => {
        month.saldo = month.faturamento.normal - month.custos.normal; // Saldo considera apenas o normal
        totals.faturamento.total += month.faturamento.total;
        totals.faturamento.normal += month.faturamento.normal;
        totals.faturamento.cancelado += month.faturamento.cancelado;
        totals.faturamento.substituida += month.faturamento.substituida;
        totals.custos.total += month.custos.total;
        totals.custos.normal += month.custos.normal;
        totals.custos.cancelado += month.custos.cancelado;
        totals.custos.substituida += month.custos.substituida;
    });
    totals.saldo = totals.faturamento.normal - totals.custos.normal;


    // --- 3. PDF GENERATION ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Relatório Fiscal Anual - ${year}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    const tableRows = monthlyData.map(data => [
        data.month.charAt(0).toUpperCase() + data.month.slice(1),
        `${formatCurrency(data.faturamento.total)}\n(N: ${formatCurrency(data.faturamento.normal)} | C: ${formatCurrency(data.faturamento.cancelado)})`,
        `${formatCurrency(data.custos.total)}\n(N: ${formatCurrency(data.custos.normal)} | C: ${formatCurrency(data.custos.cancelado)})`,
        formatCurrency(data.saldo)
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Mês', 'Faturamento (Saídas + Serviços)', 'Custos (Entradas)', 'Saldo (Normal)']],
        body: tableRows,
        foot: [
            [
                { content: 'Total Anual', styles: { fontStyle: 'bold', halign: 'right' } },
                { content: `${formatCurrency(totals.faturamento.total)}\n(N: ${formatCurrency(totals.faturamento.normal)} | C: ${formatCurrency(totals.faturamento.cancelado)})`, styles: { fontStyle: 'bold' } },
                { content: `${formatCurrency(totals.custos.total)}\n(N: ${formatCurrency(totals.custos.normal)} | C: ${formatCurrency(totals.custos.cancelado)})`, styles: { fontStyle: 'bold' } },
                { content: formatCurrency(totals.saldo), styles: { fontStyle: 'bold' } }
            ]
        ],
        theme: 'grid',
        headStyles: { fillColor: [51, 145, 255], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [240, 245, 255], textColor: 0, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto', halign: 'right' },
            2: { cellWidth: 'auto', halign: 'right' },
            3: { cellWidth: 'auto', halign: 'right' },
        },
        didParseCell: (data) => {
            // Add a small note about the breakdown
            if (data.section === 'head' && data.column.index === 1) {
                data.cell.text = [data.cell.text[0], '(Total | Normal | Cancelado)'];
            }
        }
    });

    doc.output('dataurlnewwindow');
}

    