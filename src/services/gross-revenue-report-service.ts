
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Launch } from '@/app/(app)/fiscal/page';
import { format, getYear, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

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

export async function generateGrossRevenueReportPdf(userId: string, company: Company, period: string, signatureDate: Date) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // --- 1. FETCH DATA ---
    const [monthStr, yearStr] = period.split('/');
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
    // Query only by date range to avoid composite index
    const q = query(launchesRef,
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
    );
    const snapshot = await getDocs(q);
    
    // Filter for status in memory
    const launches = snapshot.docs
        .map(doc => doc.data() as Launch)
        .filter(launch => launch.status === 'Normal');
    
    const commerceRevenue = launches
        .filter(l => l.type === 'saida')
        .reduce((sum, l) => sum + (l.valorTotalNota || 0), 0);

    const serviceRevenue = launches
        .filter(l => l.type === 'servico')
        .reduce((sum, l) => sum + (l.valorLiquido || l.valorTotalNota || 0), 0);
        
    const industryRevenue = 0; // Assuming no industrial launches for now.

    const totalCommerce = commerceRevenue;
    const totalIndustry = industryRevenue;
    const totalService = serviceRevenue;
    const grandTotal = totalCommerce + totalIndustry + totalService;
    
    // --- 2. PDF GENERATION ---
    let y = addHeader(doc, company);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO MENSAL DAS RECEITAS BRUTAS', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Company and Period Info
    autoTable(doc, {
        startY: y,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 1.5 },
        body: [
            [{ content: 'Período de apuração:', styles: { fontStyle: 'bold' } }, { content: 'MÊS', styles: { fontStyle: 'bold', halign: 'center' } }, { content: 'ANO', styles: { fontStyle: 'bold', halign: 'center' } }],
            ['', { content: format(startDate, 'MMMM', { locale: ptBR }).toUpperCase(), styles: { halign: 'center' } }, { content: getYear(startDate).toString(), styles: { halign: 'center' } }]
        ],
        columnStyles: { 0: { cellWidth: 45 } }
    });

    y = (doc as any).lastAutoTable.finalY + 5;

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
        startY: y,
        columnStyles: { 1: { halign: 'right' } },
        styles: { fontSize: 9, cellPadding: 1.5 }
    });

    y = (doc as any).lastAutoTable.finalY + 10;
    
    autoTable(doc, {
        startY: y,
        theme: 'plain',
        styles: { fontSize: 8 },
        body: [
            ['Os documentos fiscais comprobatórios das entradas de mercadorias e serviços tomados referentes ao período;'],
            ['As notas fiscais relativas às operações ou prestações realizadas eventualmente emitidas.']
        ]
    });
    
    y = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(10);
    doc.text(`${company.cidade || ''}, ${format(signatureDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, pageWidth / 2, y, { align: 'center' });
    y += 15;
    doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
    doc.text('Assinatura do Responsável', pageWidth / 2, y + 4, { align: 'center' });

    doc.output('dataurlnewwindow');
}
