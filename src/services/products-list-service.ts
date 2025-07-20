
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Produto } from '@/types/produto';

const formatCnpj = (cnpj: string): string => {
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export async function generateProductsListPdf(userId: string, company: Company) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 15;

    // --- FETCH DATA ---
    const productsRef = collection(db, `users/${userId}/companies/${company.id}/produtos`);
    const q = query(productsRef, orderBy('descricao', 'asc'));

    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produto));

    if (products.length === 0) {
        throw new Error("Nenhum produto encontrado.");
    }

    // --- PDF GENERATION ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Lista de Produtos Cadastrados`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${company.razaoSocial} | CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    const tableRows = products.map(product => [
        product.codigo,
        product.descricao,
        product.ncm,
        product.cfop,
        formatCurrency(product.valorUnitario)
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Código', 'Descrição', 'NCM', 'CFOP', 'Valor Unit.']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [51, 145, 255], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 30, halign: 'right' },
        }
    });

    doc.output('dataurlnewwindow');
}
