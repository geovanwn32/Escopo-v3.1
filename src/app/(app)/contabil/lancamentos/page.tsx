
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, BookUser, ArrowLeft, ListChecks } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import type { LancamentoContabil } from '@/types/lancamento-contabil';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { format } from 'date-fns';
import { LancamentoFormModal } from '@/components/contabil/lancamento-form-modal';
import { ContaContabil } from '@/types/conta-contabil';

export default function LancamentosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLancamento, setEditingLancamento] = useState<LancamentoContabil | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoContabil[]>([]);
  const [contas, setContas] = useState<ContaContabil[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);

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
        setLancamentos([]);
        setContas([]);
        return;
    };

    setLoading(true);
    const lancamentosRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/lancamentosContabeis`);
    const qLancamentos = query(lancamentosRef, orderBy('data', 'desc'));

    const unsubscribeLancamentos = onSnapshot(qLancamentos, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            data: doc.data().data.toDate(),
        } as LancamentoContabil));
        setLancamentos(data);
        if(!contas.length) setLoading(false);
    }, (error) => {
        console.error("Error fetching lancamentos: ", error);
        toast({ variant: "destructive", title: "Erro ao buscar lançamentos" });
        setLoading(false);
    });

    const contasRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/contasContabeis`);
    const qContas = query(contasRef, where('tipo', '==', 'analitica'));
    const unsubscribeContas = onSnapshot(qContas, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContaContabil));
        setContas(data);
        if(!lancamentos.length) setLoading(false);
    }, (error) => {
        console.error("Error fetching contas: ", error);
        toast({ variant: "destructive", title: "Erro ao buscar contas contábeis" });
        setLoading(false);
    });

    return () => {
        unsubscribeLancamentos();
        unsubscribeContas();
    }
  }, [user, activeCompany, toast]);

  const handleOpenModal = (lancamento: LancamentoContabil | null = null) => {
    setEditingLancamento(lancamento);
    setIsModalOpen(true);
  }

  const handleCloseModal = () => {
    setEditingLancamento(null);
    setIsModalOpen(false);
  }

  const handleDelete = async (id: string) => {
    if (!user || !activeCompany) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/lancamentosContabeis`, id));
      toast({ title: 'Lançamento excluído!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao excluir lançamento' });
    }
  };

  const totalPages = Math.ceil(lancamentos.length / itemsPerPage);
  const paginatedLancamentos = lancamentos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/contabil">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Voltar</span>
                </Link>
            </Button>
            <h1 className="text-2xl font-bold">Lançamentos Contábeis</h1>
        </div>
        <Button onClick={() => handleOpenModal()} disabled={!activeCompany || contas.length === 0}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Histórico de Lançamentos</CardTitle>
          <CardDescription>Visualize e gerencie os lançamentos de partidas dobradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : lancamentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                  <ListChecks className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhum lançamento encontrado</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                {!activeCompany ? "Selecione uma empresa para começar." : contas.length === 0 ? 'Cadastre contas contábeis no Plano de Contas para poder criar um lançamento.' : 'Clique em "Novo Lançamento" para começar.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLancamentos.map((lancamento) => (
                  <TableRow key={lancamento.id}>
                    <TableCell className="font-mono">{format(lancamento.data, 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium">{lancamento.descricao}</TableCell>
                    <TableCell className="text-right font-mono">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lancamento.valorTotal)}
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenModal(lancamento)}>
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
                                        <AlertDialogDescription>Esta ação não pode ser desfeita. O lançamento será permanentemente removido.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(lancamento.id!)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
         <LancamentoFormModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            userId={user.uid}
            companyId={activeCompany.id}
            lancamento={editingLancamento}
            contas={contas}
          />
      )}
    </div>
  );
}
