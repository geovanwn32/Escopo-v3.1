
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, Timestamp, startOfMonth, endOfMonth } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Payroll } from '@/types/payroll';
import type { Termination } from '@/types/termination';
import type { Thirteenth } from '@/types/thirteenth';
import type { Vacation } from '@/types/vacation';
import type { RCI } from '@/types/rci';
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
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

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


const getEventName = (item: any): string => {
    if (item.period && item.employeeName) return `Folha Pag. (${item.period})`;
    if (item.period && item.socioName) return `Pró-labore (RCI) (${item.period})`;
    if (item.vacationDays) return `Férias (Início: ${formatDate(item.startDate)})`;
    if (item.parcel) {
        const parcelLabel = { first: '1ª Parcela', second: '2ª Parcela', unique: 'Parcela Única' }[item.parcel] || item.parcel;
        return `13º Salário (${parcelLabel})`;
    }
    if (item.reason) return `Rescisão (${formatDate(item.terminationDate)})`;
    return 'Lançamento';
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


export async function generatePayrollSummaryPdf(userId: string, company: Company, period: Period) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = addHeader(doc, company);
    
    const primaryColor = [51, 145, 255]; 
    const destructiveColor = [220, 38, 38]; 
    const slate500 = [100, 116, 139]; 
    const slate100 = [241, 245, 249]; 

    // --- FETCH DATA ---
    const startDate = new Date(period.year, period.month - 1, 1);
    const endDate = new Date(period.year, period.month, 0, 23, 59, 59);

    const fetchCollection = async (collectionName: string, isPeriodBased: boolean = false, dateField: string = 'createdAt') => {
        const ref = collection(db, `users/${userId}/companies/${company.id}/${collectionName}`);
        let q;
        if (isPeriodBased) {
             const periodStr = `${String(period.month).padStart(2, '0')}/${period.year}`;
             q = query(ref, where('period', '==', periodStr));
        } else {
             q = query(ref, where(dateField, '>=', Timestamp.fromDate(startDate)), where(dateField, '<=', Timestamp.fromDate(endDate)));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const payrolls = await fetchCollection('payrolls', true) as Payroll[];
    const rcis = await fetchCollection('rcis', true) as RCI[];
    const vacations = await fetchCollection('vacations', false, 'startDate') as Vacation[];
    const thirteenths = (await fetchCollection('thirteenths', false, 'createdAt') as Thirteenth[]).filter(t => t.year === period.year);
    const terminations = await fetchCollection('terminations', false, 'terminationDate') as Termination[];

    const allItems = [...payrolls, ...rcis, ...vacations, ...thirteenths, ...terminations];
    if (allItems.length === 0) {
        throw new Error("Nenhum lançamento encontrado para o período selecionado.");
    }
    
    // Group items by employee or socio
    const itemsByPerson: { [personId: string]: any[] } = {};
    allItems.forEach(item => {
        const personId = item.employeeId || item.socioId;
        if (!personId) return; // Skip if no ID
        if (!itemsByPerson[personId]) {
            itemsByPerson[personId] = [];
        }
        itemsByPerson[personId].push(item);
    });

    // --- PDF GENERATION ---
    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Resumo da Folha de Pagamento - ${String(period.month).padStart(2, '0')}/${period.year}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    let grandTotalProventos = 0;
    let grandTotalDescontos = 0;
    const allTableRows: any[] = [];

    for (const personId in itemsByPerson) {
        const personItems = itemsByPerson[personId];
        const personName = personItems[0].employeeName || personItems[0].socioName;
        const personType = personItems[0].employeeName ? 'Funcionário' : 'Sócio';

        // Add a group header row for the person
        allTableRows.push([{ content: `${personType}: ${personName}`, colSpan: 5, styles: { fillColor: slate500, textColor: 255, fontStyle: 'bold' } }]);

        for (const item of personItems) {
            // Unify logic to find events array
            const events = item.events || item.result?.events || [];
            
            if (events.length > 0) {
                 allTableRows.push([{ content: getEventName(item), colSpan: 5, styles: { fillColor: slate100, textColor: 50, fontStyle: 'bold', fontSize: 9 } }]);
            }
            events.forEach((ev: any) => {
                 const rubricaDesc = ev.rubrica?.descricao || ev.descricao || 'Evento desconhecido';
                 const referencia = typeof ev.referencia === 'number' ? ev.referencia.toFixed(2) : ev.referencia ?? '';
                 const provento = ev.provento ?? 0;
                 const desconto = ev.desconto ?? 0;

                 allTableRows.push([
                    '', // Empty first column for indentation
                    rubricaDesc,
                    referencia,
                    formatCurrency(provento),
                    formatCurrency(desconto)
                ]);
            });

            // Unify logic to find totals object
            const totals = item.totals || item.result;
            if (totals) {
                // Ensure we use totalProventos and totalDescontos if available, otherwise fallback for vacation/termination which might have a different structure
                 grandTotalProventos += totals.totalProventos ?? 0;
                 grandTotalDescontos += totals.totalDescontos ?? 0;
            }
        }
    }
    
    const grandTotalLiquido = grandTotalProventos - grandTotalDescontos;

    autoTable(doc, {
        startY: y,
        head: [['', 'Verba', 'Referência', 'Proventos', 'Descontos']],
        body: allTableRows,
        foot: [
            [
                { content: 'TOTAIS GERAIS DA EMPRESA', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: slate100, textColor: 0 } },
                { content: formatCurrency(grandTotalProventos), styles: { fontStyle: 'bold', fillColor: slate100, textColor: 0 } },
                { content: formatCurrency(grandTotalDescontos), styles: { fontStyle: 'bold', fillColor: slate100, textColor: destructiveColor } },
            ],
            [
                 { content: 'LÍQUIDO A PAGAR:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: slate100, textColor: 0 } },
                { content: formatCurrency(grandTotalLiquido), styles: { fontStyle: 'bold', fillColor: slate100, textColor: primaryColor } },
            ]
        ],
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
        footStyles: { halign: 'right' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        didParseCell: function(data) {
            // This is to color the footer text since jspdf-autotable has issues with it
            if (data.row.section === 'foot') {
                if (data.column.index === 4 && data.row.index === 0) data.cell.styles.textColor = destructiveColor;
                if (data.column.index === 4 && data.row.index === 1) data.cell.styles.textColor = primaryColor;
            }
        },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 25, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' },
        }
    });

    y = (doc as any).lastAutoTable.finalY + 15;
    
    if (y > 250) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Embasamento Legal', 14, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const legalText = `Este relatório é um resumo gerencial dos lançamentos de folha de pagamento para o período de competência e não substitui os documentos legais individuais (holerites, recibos de férias, TRCT), que devem ser emitidos e assinados em conformidade com a Consolidação das Leis do Trabalho (CLT) e demais legislações aplicáveis. Os valores aqui apresentados servem como base para a apuração de guias de recolhimento de impostos e contribuições como FGTS, INSS e IRRF.`;
    doc.text(legalText, 14, y, { maxWidth: pageWidth - 28, lineHeightFactor: 1.5 });
    
    doc.output('dataurlnewwindow');
}
