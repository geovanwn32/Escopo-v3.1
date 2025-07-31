import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from '@/types/company';
import type { ContaContabil } from '@/types/conta-contabil';
import { format } from 'date-fns';

const formatCnpj = (cnpj: string): string => {
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

export function generateChartOfAccountsPdf(company: Company, accounts: ContaContabil[]) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 15;

    // --- HEADER ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Plano de Contas`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${company.razaoSocial} | CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    const tableRows = accounts.map(account => [
        account.codigo,
        account.nome,
        account.tipo.charAt(0).toUpperCase() + account.tipo.slice(1),
        account.natureza.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Código', 'Nome da Conta', 'Tipo', 'Natureza']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [51, 145, 255], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 25, halign: 'center' },
            3: { cellWidth: 35, halign: 'center' },
        }
    });

    doc.output('dataurlnewwindow');
}
