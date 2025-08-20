
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { ContaContabil } from '@/types/conta-contabil';
import type { LancamentoContabil, Partida } from '@/types/lancamento-contabil';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0,00';
  const formatted = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if(value < 0) return `${formatted.replace('-', '')} C`;
  return `${formatted} D`;
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

interface AccountBalance {
    codigo: string;
    nome: string;
    saldoAnterior: number;
    debito: number;
    credito: number;
    saldoFinal: number;
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

export async function generateTrialBalancePdf(userId: string, company: Company, dateRange: DateRange): Promise<boolean> {

    if (!dateRange.from || !dateRange.to) {
        throw new Error("Período de datas inválido.");
    }
    
    // --- 1. FETCH DATA ---
    const contasRef = collection(db, `users/${userId}/companies/${company.id}/contasContabeis`);
    const qContas = query(contasRef, orderBy('codigo'));
    const contasSnap = await getDocs(qContas);
    const allContas = contasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContaContabil));

    const lancamentosRef = collection(db, `users/${userId}/companies/${company.id}/lancamentosContabeis`);
    
    // Fetch launches before the period for previous balance
    const qAnteriores = query(lancamentosRef, where('data', '<', Timestamp.fromDate(dateRange.from)));
    const lancamentosAnterioresSnap = await getDocs(qAnteriores);
    const lancamentosAnteriores = lancamentosAnterioresSnap.docs.map(doc => doc.data() as LancamentoContabil);
    
    // Fetch launches within the period for movements
    const qPeriodo = query(lancamentosRef, 
        where('data', '>=', Timestamp.fromDate(dateRange.from)), 
        where('data', '<=', Timestamp.fromDate(new Date(dateRange.to.setHours(23, 59, 59, 999))))
    );
    const lancamentosPeriodoSnap = await getDocs(qPeriodo);
    const lancamentosPeriodo = lancamentosPeriodoSnap.docs.map(doc => doc.data() as LancamentoContabil);

    if (lancamentosAnteriores.length === 0 && lancamentosPeriodo.length === 0) {
        return false;
    }

    // --- 2. PROCESS DATA ---
    const balances: { [contaId: string]: AccountBalance } = {};

    allContas.forEach(conta => {
        if(conta.tipo === 'analitica') {
             balances[conta.id!] = {
                codigo: conta.codigo,
                nome: conta.nome,
                saldoAnterior: 0,
                debito: 0,
                credito: 0,
                saldoFinal: 0,
            };
        }
    });

    const processPartidas = (partidas: Partida[], target: 'saldoAnterior' | 'movimento') => {
        partidas.forEach(partida => {
            if (balances[partida.contaId]) {
                if (target === 'saldoAnterior') {
                    balances[partida.contaId].saldoAnterior += partida.tipo === 'debito' ? partida.valor : -partida.valor;
                } else {
                    if (partida.tipo === 'debito') balances[partida.contaId].debito += partida.valor;
                    else balances[partida.contaId].credito += partida.valor;
                }
            }
        });
    };

    lancamentosAnteriores.forEach(l => processPartidas(l.partidas, 'saldoAnterior'));
    lancamentosPeriodo.forEach(l => processPartidas(l.partidas, 'movimento'));

    Object.values(balances).forEach(bal => {
        bal.saldoFinal = bal.saldoAnterior + bal.debito - bal.credito;
    });

    // --- 3. PDF GENERATION ---
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = addHeader(doc, company);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Balancete de Verificação`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${formatDate(dateRange.from)} a ${formatDate(dateRange.to)}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    const tableRows = Object.values(balances)
        .filter(b => b.saldoAnterior !== 0 || b.debito !== 0 || b.credito !== 0 || b.saldoFinal !== 0) // Only show accounts with activity
        .map(b => [
            b.codigo,
            b.nome,
            formatCurrency(b.saldoAnterior),
            formatCurrency(b.debito).replace(' D', ''),
            formatCurrency(b.credito).replace(' C', ''),
            formatCurrency(b.saldoFinal)
        ]);

    const totalDebito = Object.values(balances).reduce((acc, b) => acc + b.debito, 0);
    const totalCredito = Object.values(balances).reduce((acc, b) => acc + b.credito, 0);

    autoTable(doc, {
        startY: y,
        head: [['Conta', 'Descrição', 'S. Anterior', 'Débitos', 'Créditos', 'S. Final']],
        body: tableRows,
        foot: [
            [{ content: 'TOTAIS', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
             formatCurrency(totalDebito),
             formatCurrency(totalCredito).replace(' C', ''),
             ''
            ]
        ],
        theme: 'grid',
        headStyles: { fillColor: [51, 145, 255], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 25, halign: 'right' },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 25, halign: 'right' },
        }
    });

    doc.output('dataurlnewwindow');
    return true;
}
