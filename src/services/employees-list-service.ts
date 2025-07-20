
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
import { format } from 'date-fns';

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

const formatCpf = (cpf: string): string => {
    if (!cpf) return '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export async function generateEmployeesListPdf(userId: string, company: Company) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 15;

    // --- FETCH DATA ---
    const employeesRef = collection(db, `users/${userId}/companies/${company.id}/employees`);
    const q = query(employeesRef, orderBy('nomeCompleto', 'asc'));

    const snapshot = await getDocs(q);
    // Filter for active employees in the client
    const employees = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Employee))
        .filter(employee => employee.ativo === true);

    if (employees.length === 0) {
        throw new Error("Nenhum funcionário ativo encontrado.");
    }

    // --- PDF GENERATION ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Lista de Funcionários Ativos`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${company.razaoSocial} | CNPJ: ${formatCnpj(company.cnpj)}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    const tableRows = employees.map(employee => [
        employee.nomeCompleto,
        formatCpf(employee.cpf),
        employee.cargo,
        formatDate(employee.dataAdmissao)
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Nome Completo', 'CPF', 'Cargo', 'Data de Admissão']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [51, 145, 255], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 40 },
            3: { cellWidth: 25, halign: 'center' },
        }
    });

    doc.output('dataurlnewwindow');
}
