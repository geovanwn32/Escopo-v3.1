
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, BookCopy } from "lucide-react";
import { ContaContabilFormModal } from '@/components/contabil/conta-form-modal';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import type { ContaContabil } from '@/types/conta-contabil';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

export default function PlanoDeContasPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaContabil | null>(null);
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
      await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/contasContabeis`, contaId));
      toast({
        title: 'Conta Contábil excluída!',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir conta',
      });
    }
  };

  const totalPages = Math.ceil(contas.length / itemsPerPage);
  const paginatedContas = contas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Plano de Contas</h1>
        <Button onClick={() => handleOpenModal()} disabled={!activeCompany}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Conta
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Contas Cadastradas</CardTitle>
          <CardDescription>Gerencie a estrutura de contas contábeis da empresa.</CardDescription>
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
                {!activeCompany ? "Selecione uma empresa para começar." : 'Clique em "Nova Conta" para começar.'}
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
