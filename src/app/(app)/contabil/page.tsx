
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp, doc, deleteDoc } from "firebase/firestore";
import Link from 'next/link';
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PlusCircle, BookOpen, ChevronsRightLeft, BookLock, ChevronDown, Loader2, MoreHorizontal, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, BookUser } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SimpleEntryModal } from "@/components/contabil/simple-entry-modal";

export interface AccountingEntry {
  id: string;
  date: Date;
  debitAccount: string;
  creditAccount: string;
  value: number;
  description: string;
}

export default function ContabilPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AccountingEntry | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const companyId = sessionStorage.getItem('activeCompanyId');
        setActiveCompanyId(companyId);
    }
  }, []);

  useEffect(() => {
    if (!user || !activeCompanyId) {
      setLoading(false);
      setEntries([]);
      return;
    }

    setLoading(true);
    const entriesRef = collection(db, `users/${user.uid}/companies/${activeCompanyId}/accountingEntries`);
    const q = query(entriesRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entriesData = snapshot.docs.map(doc => {
        const data = doc.data();
        // The accounting entry from the AI flow stores debit.account and credit.account
        // but the manual one stores debitAccount and creditAccount. We need to handle both.
        return {
          id: doc.id,
          date: (data.date as Timestamp).toDate(),
          debitAccount: data.debit?.account || data.debitAccount,
          creditAccount: data.credit?.account || data.creditAccount,
          value: data.debit?.amount || data.value,
          description: data.description,
        } as AccountingEntry;
      });
      setEntries(entriesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching accounting entries: ", error);
      toast({
        variant: "destructive",
        title: "Erro ao buscar lançamentos",
        description: "Não foi possível carregar os lançamentos contábeis."
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeCompanyId, toast]);

  const handleOpenModal = (mode: 'create' | 'edit' | 'view', entry?: AccountingEntry) => {
    setModalMode(mode);
    setEditingEntry(entry || null);
    setIsModalOpen(true);
  };
  
  const handleDeleteEntry = async (entryId: string) => {
     if (!user || !activeCompanyId) return;
      try {
        await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompanyId}/accountingEntries`, entryId));
        toast({ title: "Lançamento excluído com sucesso!" });
      } catch (error) {
        console.error("Error deleting entry: ", error);
        toast({ variant: "destructive", title: "Erro ao excluir lançamento" });
      }
  }

  const totalPages = Math.ceil(entries.length / itemsPerPage);
  const paginatedEntries = entries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );


  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Módulo Contábil</h1>
            <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={!activeCompanyId}>
                      Lançamentos Manuais
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleOpenModal('create')}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      <span>Lançamento Simples</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <ChevronsRightLeft className="mr-2 h-4 w-4" />
                      <span>Lançamento Múltiplo</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <BookLock className="mr-2 h-4 w-4" />
                      <span>Lançamento de Encerramento</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" asChild>
                  <Link href="/plano-de-contas">
                    <BookUser className="mr-2 h-4 w-4" />
                    Plano de Contas
                  </Link>
                </Button>
            </div>
        </div>
        <Card>
            <CardHeader>
            <CardTitle>Diário Contábil</CardTitle>
            <CardDescription>Visualize os lançamentos contábeis da empresa.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !activeCompanyId ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 bg-muted rounded-full mb-4">
                        <BookOpen className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">Nenhuma empresa selecionada</h3>
                    <p className="text-muted-foreground mt-2">Selecione uma empresa para ver os lançamentos.</p>
                </div>
              ) : entries.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 bg-muted rounded-full mb-4">
                        <BookOpen className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">Nenhum lançamento encontrado</h3>
                    <p className="text-muted-foreground mt-2">Comece a fazer lançamentos manuais ou importe do módulo fiscal.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Conta Débito</TableHead>
                      <TableHead>Conta Crédito</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Intl.DateTimeFormat('pt-BR').format(entry.date)}</TableCell>
                        <TableCell>{entry.debitAccount}</TableCell>
                        <TableCell>{entry.creditAccount}</TableCell>
                        <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                        <TableCell className="text-right font-medium">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.value)}
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
                              <DropdownMenuItem onClick={() => handleOpenModal('view', entry)}>
                                <Eye className="mr-2 h-4 w-4" /> Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenModal('edit', entry)}>
                                <Pencil className="mr-2 h-4 w-4" /> Alterar
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta ação é permanente. Deseja mesmo excluir este lançamento?</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteEntry(entry.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                  Próximo <ChevronRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            )}
        </Card>

        {isModalOpen && user && activeCompanyId && (
          <SimpleEntryModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            mode={modalMode}
            entry={editingEntry}
            userId={user.uid}
            companyId={activeCompanyId}
          />
        )}
    </div>
  );
}
