
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
    const launches = snapshot.docs.map(doc => doc.data() as Launch).filter(l => l.status === 'Normal');

    if (launches.length === 0) {
        throw new Error("Nenhum lançamento fiscal com status 'Normal' encontrado para o ano selecionado.");
    }

    // --- 2. PROCESS DATA ---
    const monthlyData: { month: string; entradas: number; saidas: number; saldo: number }[] = Array.from({ length: 12 }, (_, i) => ({
        month: format(new Date(year, i, 1), 'MMMM', { locale: ptBR }),
        entradas: 0,
        saidas: 0,
        saldo: 0,
    }));

    launches.forEach(launch => {
        const launchDate = (launch.date as any).toDate ? (launch.date as any).toDate() : new Date(launch.date);
        const monthIndex = getMonth(launchDate);
        const value = launch.valorLiquido || launch.valorTotalNota || 0;

        if (launch.type === 'saida' || launch.type === 'servico') {
            monthlyData[monthIndex].saidas += value;
        } else if (launch.type === 'entrada') {
            monthlyData[monthIndex].entradas += value;
        }
    });

    let totalEntradas = 0;
    let totalSaidas = 0;
    monthlyData.forEach(month => {
        month.saldo = month.saidas - month.entradas;
        totalEntradas += month.entradas;
        totalSaidas += month.saidas;
    });

    const totalSaldo = totalSaidas - totalEntradas;

    // --- 3. PDF GENERATION ---
    const tableRows = monthlyData.map(data => [
        data.month.charAt(0).toUpperCase() + data.month.slice(1),
        formatCurrency(data.saidas),
        formatCurrency(data.entradas),
        formatCurrency(data.saldo)
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Mês', 'Faturamento (Saídas + Serviços)', 'Custos (Entradas)', 'Saldo']],
        body: tableRows,
        foot: [
            [
                { content: 'Total Anual', styles: { fontStyle: 'bold', halign: 'right' } },
                { content: formatCurrency(totalSaidas), styles: { fontStyle: 'bold' } },
                { content: formatCurrency(totalEntradas), styles: { fontStyle: 'bold' } },
                { content: formatCurrency(totalSaldo), styles: { fontStyle: 'bold' } }
            ]
        ],
        theme: 'grid',
        headStyles: { fillColor: [51, 145, 255], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [240, 245, 255], textColor: 0 },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
        }
    });

    doc.output('dataurlnewwindow');
}
