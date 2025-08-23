
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Launch } from '@/app/(app)/fiscal/page';
import { format, getMonth, getYear, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

export async function generateGrossRevenueReportPdf(userId: string, company: Company, period: string) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // --- 1. FETCH DATA ---
    const [monthStr, yearStr] = period.split('/');
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
    const q = query(launchesRef,
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate)),
        where('status', '==', 'Normal')
    );
    const snapshot = await getDocs(q);
    const launches = snapshot.docs.map(doc => doc.data() as Launch);
    
    const commerceRevenue = launches
        .filter(l => l.type === 'saida')
        .reduce((sum, l) => sum + (l.valorTotalNota || 0), 0);

    const serviceRevenue = launches
        .filter(l => l.type === 'servico')
        .reduce((sum, l) => sum + (l.valorLiquido || 0), 0);
        
    const industryRevenue = 0; // Assuming no industrial launches for now.

    const totalCommerce = commerceRevenue;
    const totalIndustry = industryRevenue;
    const totalService = serviceRevenue;
    const grandTotal = totalCommerce + totalIndustry + totalService;
    
    // --- 2. PDF GENERATION ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO MENSAL DAS RECEITAS BRUTAS', pageWidth / 2, 15, { align: 'center' });

    // Company and Period Info
    autoTable(doc, {
        startY: 20,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 1 },
        body: [
            [{ content: 'EMPRESA:', styles: { fontStyle: 'bold' } }, { content: `${company.cnpj.slice(0, 8)} ${company.razaoSocial}`, colSpan: 3 }],
            [{ content: 'CNPJ:', styles: { fontStyle: 'bold' } }, { content: formatCnpj(company.cnpj), colSpan: 3 }],
            [{ content: 'Período de apuração:', styles: { fontStyle: 'bold' } }, { content: 'MÊS', styles: { fontStyle: 'bold', halign: 'center' } }, { content: 'ANO', styles: { fontStyle: 'bold', halign: 'center' } }],
            ['', { content: format(startDate, 'MMMM', { locale: ptBR }).toUpperCase(), styles: { halign: 'center' } }, { content: getYear(startDate), styles: { halign: 'center' } }]
        ],
    });

    const reportData = [
        [{ content: 'RECEITA BRUTA MENSAL - REVENDA DE MERCADORIAS (COMÉRCIO)', colSpan: 2, styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } }],
        ['I - Revenda de mercadorias com dispensa de emissão de documento fiscal', { content: formatCurrency(0), styles: { halign: 'right' } }],
        ['II - Revenda de mercadorias com documento fiscal emitido', { content: formatCurrency(commerceRevenue), styles: { halign: 'right' } }],
        [{ content: 'III - Total das receitas com revenda de mercadorias (I + II)', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: formatCurrency(totalCommerce), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }],
        
        [{ content: 'RECEITA BRUTA MENSAL – VENDA DE PRODUTOS INDUSTRIALIZADOS (INDÚSTRIA)', colSpan: 2, styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } }],
        ['IV - Venda de produtos industrializados com dispensa de emissão de documento fiscal', { content: formatCurrency(0), styles: { halign: 'right' } }],
        ['V - Venda de produtos industrializados com documento fiscal emitido', { content: formatCurrency(industryRevenue), styles: { halign: 'right' } }],
        [{ content: 'VI - Total das receitas com venda de produtos industrializ. (IV + V)', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: formatCurrency(totalIndustry), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }],

        [{ content: 'RECEITA BRUTA MENSAL - PRESTAÇÃO DE SERVIÇOS', colSpan: 2, styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } }],
        ['VII - Receita com prestação de serviços com dispensa de emissão de documento fiscal', { content: formatCurrency(0), styles: { halign: 'right' } }],
        ['VIII - Receita com prestação de serviços com documento fiscal emitido', { content: formatCurrency(serviceRevenue), styles: { halign: 'right' } }],
        [{ content: 'IX - Total das receitas com prestação de serviços (VII + VIII)', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: formatCurrency(totalService), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }],

        [{ content: 'X - Total geral das receitas brutas no mês (III + VI + IX)', styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }, { content: formatCurrency(grandTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [220, 220, 220] } }],
    ];
    
    autoTable(doc, {
        body: reportData,
        theme: 'grid',
        startY: (doc as any).lastAutoTable.finalY,
        columnStyles: { 1: { halign: 'right' } }
    });

    const today = new Date();
    autoTable(doc, {
        body: [
            [{ content: 'LOCAL E DATA:', styles: { fontStyle: 'bold', valign: 'middle'} }, { content: `${format(today, 'd')}`, styles: { halign: 'center'} }, { content: `${format(today, 'MMMM', {locale: ptBR}).toUpperCase()}`, styles: { halign: 'center'}}, { content: `${format(today, 'yyyy')}`, styles: { halign: 'center'}}, { content: 'ASSINATURA', styles: { fontStyle: 'bold', valign: 'middle'}}],
            [{ content: `${company.cidade || ''}`, colSpan: 4}, '']
        ],
        theme: 'grid',
        startY: (doc as any).lastAutoTable.finalY,
    });
    
    let y = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(8);
    doc.text('Os documentos fiscais comprobatórios das entradas de mercadorias e serviços tomados referentes ao período;', 14, y);
    y += 4;
    doc.text('As notas fiscais relativas às operações ou prestações realizadas eventualmente emitidas.', 14, y);


    doc.output('dataurlnewwindow');
}
