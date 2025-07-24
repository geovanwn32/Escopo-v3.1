
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, ArrowUpRightSquare, ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import type { ContaReceber, ContaReceberStatus } from '@/types/conta-receber';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format } from 'date-fns';
import { ContaReceberFormModal } from '@/components/financeiro/conta-receber-form-modal';
import type { Partner } from '@/types/partner';

export default function ContasAReceberPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaReceber | null>(null);
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [parceiros, setParceiros] = useState<Partner[]>([]);
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
        setParceiros([]);
        return;
    };

    setLoading(true);
    let activeListeners = 2;
    const onDone = () => {
        activeListeners--;
        if (activeListeners === 0) setLoading(false);
    }
    
    const contasRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/contasAReceber`);
    const qContas = query(contasRef, orderBy('dueDate', 'desc'));
    const unsubscribeContas = onSnapshot(qContas, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            issueDate: doc.data().issueDate.toDate(),
            dueDate: doc.data().dueDate.toDate(),
        } as ContaReceber));
        setContas(data);
        onDone();
    }, (error) => { console.error("Error fetching contas: ", error); toast({ variant: "destructive", title: "Erro ao buscar contas" }); onDone(); });

    const partnersRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/partners`);
    const qPartners = query(partnersRef, orderBy('razaoSocial', 'asc'));
    const unsubscribePartners = onSnapshot(qPartners, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner));
        setParceiros(data);
        onDone();
    }, (error) => { console.error("Error fetching parceiros: ", error); toast({ variant: "destructive", title: "Erro ao buscar parceiros" }); onDone(); });

    return () => {
        unsubscribeContas();
        unsubscribePartners();
    }
  }, [user, activeCompany, toast]);

  const handleOpenModal = (conta: ContaReceber | null = null) => {
    setEditingConta(conta);
    setIsModalOpen(true);
  }

  const handleCloseModal = () => {
    setEditingConta(null);
    setIsModalOpen(false);
  }

  const handleDelete = async (id: string) => {
    if (!user || !activeCompany) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/contasAReceber`, id));
      toast({ title: 'Conta a receber excluída!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao excluir conta' });
    }
  };

  const handleUpdateStatus = async (id: string, status: ContaReceberStatus) => {
     if (!user || !activeCompany) return;
    try {
      const docRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/contasAReceber`, id)
      await updateDoc(docRef, { status: status });
      toast({ title: 'Status da conta atualizado!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar status' });
    }
  }

  const getStatusVariant = (status: ContaReceberStatus) => {
    switch (status) {
        case 'aberta': return 'default';
        case 'paga': return 'success';
        case 'vencida': return 'destructive';
        case 'cancelada': return 'secondary';
        default: return 'outline';
    }
  }

  const totalPages = Math.ceil(contas.length / itemsPerPage);
  const paginatedContas = contas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/financeiro">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Voltar</span>
                </Link>
            </Button>
            <h1 className="text-2xl font-bold">Contas a Receber</h1>
        </div>
        <Button onClick={() => handleOpenModal()} disabled={!activeCompany || parceiros.length === 0}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Histórico de Lançamentos</CardTitle>
          <CardDescription>Gerencie suas contas a receber de clientes.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                  <ArrowUpRightSquare className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhum lançamento encontrado</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                {!activeCompany ? "Selecione uma empresa para começar." : parceiros.length === 0 ? 'Cadastre parceiros (clientes) para poder criar um lançamento.' : 'Clique em "Novo Lançamento" para começar.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContas.map((conta) => (
                  <TableRow key={conta.id}>
                    <TableCell className="font-medium">{conta.partnerName}</TableCell>
                    <TableCell>{conta.description}</TableCell>
                    <TableCell className="font-mono">{format(conta.dueDate, 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-mono">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.value)}
                    </TableCell>
                    <TableCell>
                        <Badge variant={getStatusVariant(conta.status)} className="capitalize">{conta.status}</Badge>
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
                             <DropdownMenuItem onClick={() => handleUpdateStatus(conta.id!, 'paga')} disabled={conta.status === 'paga'}>
                                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                Marcar como Paga
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleUpdateStatus(conta.id!, 'cancelada')} disabled={conta.status === 'cancelada'}>
                                <XCircle className="mr-2 h-4 w-4 text-gray-500" />
                                Cancelar Lançamento
                            </DropdownMenuItem>
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
                                        <AlertDialogDescription>Esta ação não pode ser desfeita. O lançamento será permanentemente removido.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(conta.id!)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
         <ContaReceberFormModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            userId={user.uid}
            companyId={activeCompany.id}
            conta={editingConta}
            parceiros={parceiros}
          />
      )}
    </div>
  );
}
