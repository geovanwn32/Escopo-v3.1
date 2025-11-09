
"use client";

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, writeBatch, getDocs, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, BookCopy, ArrowLeft, BookUp, Info, FileDown, FileText } from "lucide-react";
import { ContaContabilFormModal } from '@/components/contabil/conta-form-modal';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import type { ContaContabil } from '@/types/conta-contabil';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { generateChartOfAccountsPdf } from '@/services/chart-of-accounts-report-service';

export default function PlanoDeContasPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaContabil | null>(null);
  const [contas, setContas] = useState<ContaContabil[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { user } = useAuth();
  const { toast } = useToast();

   useEffect(() => {
    if (typeof window !== 'undefined') {
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (user && companyId) {
            const companyDataString = sessionStorage.getItem(`company_${companyId}`);
            if (companyDataString) {
                setActiveCompany(JSON.parse(companyDataString));
            }
        } else {
            setLoading(false);
        }
    }
  }, [user]);
  
  useEffect(() => {
    if (!user || !activeCompany) {
        setLoading(false);
        setContas([]);
        return;
    };

    setLoading(true);
    const contasRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/contasContabeis`);
    const q = query(contasRef, orderBy('codigo'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const contasData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as ContaContabil));
        setContas(contasData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching contas: ", error);
        toast({
            variant: "destructive",
            title: "Erro ao buscar plano de contas",
        });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeCompany, toast]);

  const handleOpenModal = (conta: ContaContabil | null = null) => {
    setEditingConta(conta);
    setIsModalOpen(true);
  }

  const handleCloseModal = () => {
    setEditingConta(null);
    setIsModalOpen(false);
  }

  const handleDeleteConta = async (contaId: string) => {
    if (!user || !activeCompany) return;
  
    try {
      // Check if account is used in any lancamento
      const lancamentosRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/lancamentosContabeis`);
      const q = query(lancamentosRef, where('partidas', 'array-contains-any', [ { contaId: contaId, tipo: 'debito' }, { contaId: contaId, tipo: 'credito' } ]), limit(1));
      const lancamentoSnap = await getDocs(q);
      
      const relatedLancamentos = await getDocs(
        query(lancamentosRef, where("partidas", "array-contains-any", [{tipo: 'debito', valor: 0, contaId: contaId}, {tipo: 'credito', valor: 0, contaId: contaId}] ))
      );

      const checkQuery = query(
        collection(db, `users/${user.uid}/companies/${activeCompany.id}/lancamentosContabeis`),
        where('partidas', 'array-contains-any', [
          { contaId, tipo: 'debito', valor: 0 }, // Placeholder, valor doesn't matter for the check
          { contaId, tipo: 'credito', valor: 0 }
        ]),
        limit(1)
      );
    
    // Firestore does not support querying array of objects with partial matches directly.
    // A workaround is to get all documents and filter client-side, but that's inefficient for large datasets.
    // The most performant way requires changing the data structure, e.g., adding a `contaIds` array to each lancamento.
    // For now, we will do a slightly less efficient but functional check.
    const allLancamentosSnap = await getDocs(collection(db, `users/${user.uid}/companies/${activeCompany.id}/lancamentosContabeis`));
    const isUsed = allLancamentosSnap.docs.some(doc => 
      doc.data().partidas.some((partida: any) => partida.contaId === contaId)
    );

    if (isUsed) {
        toast({
          variant: 'destructive',
          title: 'Exclusão não permitida',
          description: 'Esta conta está sendo usada em um ou mais lançamentos contábeis e não pode ser excluída.',
        });
        return;
    }


      await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/contasContabeis`, contaId));
      toast({
        title: 'Conta Contábil excluída!',
      });
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir conta',
        description: 'Ocorreu um problema inesperado ao tentar excluir a conta.'
      });
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !user || !activeCompany) return;
    setIsImporting(true);
    const file = event.target.files[0];

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            const contasToImport: ContaContabil[] = jsonData
                .slice(1) // Skip header row
                .map(row => ({
                    codigo: String(row[0] || ''),
                    nome: String(row[1] || ''),
                    tipo: String(row[2] || '').toLowerCase() as 'analitica' | 'sintetica',
                    natureza: String(row[3] || '').toLowerCase().replace(' ', '_') as any,
                }))
                .filter(c => c.codigo && c.nome && ['analitica', 'sintetica'].includes(c.tipo) && ['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa'].includes(c.natureza));

            if (contasToImport.length === 0) {
                toast({ variant: 'destructive', title: "Nenhum dado válido encontrado", description: "Verifique o formato do arquivo. Cabeçalhos esperados: Codigo, Nome, Tipo, Natureza" });
                setIsImporting(false);
                return;
            }

            const existingContasSnap = await getDocs(collection(db, `users/${user.uid}/companies/${activeCompany.id}/contasContabeis`));
            const existingCodes = new Set(existingContasSnap.docs.map(d => d.data().codigo));

            const batch = writeBatch(db);
            let importedCount = 0;
            contasToImport.forEach(conta => {
                if (!existingCodes.has(conta.codigo)) {
                    const docRef = doc(collection(db, `users/${user.uid}/companies/${activeCompany.id}/contasContabeis`));
                    batch.set(docRef, conta);
                    importedCount++;
                }
            });

            await batch.commit();
            toast({ title: "Importação Concluída!", description: `${importedCount} novas contas importadas com sucesso.` });
        };
        reader.readAsBinaryString(file);
    } catch (error) {
         toast({ variant: 'destructive', title: 'Erro na Importação', description: 'Houve um problema ao ler o arquivo.' });
         console.error(error);
    } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const handleExportExcel = () => {
    if (contas.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhuma conta para exportar.' });
        return;
    }
    const dataToExport = contas.map(conta => ({
        'Codigo': conta.codigo,
        'Nome': conta.nome,
        'Tipo': conta.tipo,
        'Natureza': conta.natureza,
        'Descricao': conta.descricao || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PlanoDeContas");

    worksheet['!cols'] = [
        { wch: 15 }, // Codigo
        { wch: 40 }, // Nome
        { wch: 15 }, // Tipo
        { wch: 20 }, // Natureza
        { wch: 50 }, // Descricao
    ];

    XLSX.writeFile(workbook, `plano_de_contas_${activeCompany?.nomeFantasia.replace(/\s/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: "Exportação Iniciada!", description: "O download do arquivo foi iniciado." });
  };
  
   const handleGeneratePdf = () => {
    if (!activeCompany || contas.length === 0) {
      toast({ variant: 'destructive', title: 'Nenhuma conta para gerar o PDF.' });
      return;
    }
    setIsGeneratingPdf(true);
    try {
      generateChartOfAccountsPdf(activeCompany, contas);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao Gerar PDF', description: (error as Error).message });
    } finally {
      setIsGeneratingPdf(false);
    }
  };


  const totalPages = Math.ceil(contas.length / itemsPerPage);
  const paginatedContas = contas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".xlsx" />
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/contabil">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Voltar</span>
                </Link>
            </Button>
            <h1 className="text-2xl font-bold">Plano de Contas</h1>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleGeneratePdf} disabled={!activeCompany || contas.length === 0 || isGeneratingPdf}>
                {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Gerar PDF
            </Button>
            <Button variant="outline" onClick={handleExportExcel} disabled={!activeCompany || contas.length === 0}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar Plano (XLSX)
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!activeCompany || isImporting}>
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookUp className="mr-2 h-4 w-4" />}
                Importar Plano (XLSX)
            </Button>
            <Button onClick={() => handleOpenModal()} disabled={!activeCompany}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Conta
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Contas Cadastradas</CardTitle>
          <CardDescription>Gerencie a estrutura de contas contábeis da empresa.</CardDescription>
          <Alert variant="default" className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Para importar um plano de contas via arquivo XLSX, certifique-se que a primeira linha contém os cabeçalhos: <strong>Codigo</strong>, <strong>Nome</strong>, <strong>Tipo</strong> e <strong>Natureza</strong>.<br/>
              Valores aceitos para <strong>Tipo</strong>: 'analitica' ou 'sintetica'.<br/>
              Valores aceitos para <strong>Natureza</strong>: 'ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa'.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                  <BookCopy className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhuma conta cadastrada</h3>
              <p className="text-muted-foreground mt-2">
                {!activeCompany ? "Selecione uma empresa para começar." : 'Clique em "Nova Conta" ou "Importar Plano" para começar.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome da Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Natureza</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContas.map((conta) => (
                  <TableRow key={conta.id}>
                    <TableCell className="font-mono">{conta.codigo}</TableCell>
                    <TableCell className="font-medium">{conta.nome}</TableCell>
                    <TableCell>
                        <Badge variant={conta.tipo === 'analitica' ? 'default' : 'secondary'} className="capitalize">
                            {conta.tipo}
                        </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{conta.natureza.replace('_', ' ')}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenModal(conta)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Alterar
                            </DropdownMenuItem>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Excluir
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação não pode ser desfeita. A conta será permanentemente removida.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteConta(conta.id!)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex justify-end items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                </Button>
                <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </CardFooter>
        )}
      </Card>
      
      {user && activeCompany && (
         <ContaContabilFormModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            userId={user.uid}
            companyId={activeCompany.id}
            conta={editingConta}
          />
      )}
    </div>
  );
}
