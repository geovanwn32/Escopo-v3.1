
"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Wrench, MoreHorizontal, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { ServicoFormModal } from '@/components/servicos/servico-form-modal';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import type { Servico } from '@/types/servico';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { defaultServices } from '@/lib/default-services';


export default function ServicosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
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
             setIsInitializing(false);
             setLoading(false);
        }
    }
  }, [user]);

  const initializeServicesIfNeeded = useCallback(async () => {
    if (!user || !activeCompany) {
      setIsInitializing(false);
      return;
    }

    const servicosRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/servicos`);
    const snapshot = await getDocs(query(servicosRef, {}));
    
    if (snapshot.empty) {
        toast({ title: 'Inicializando Catálogo', description: 'Cadastrando a lista de serviços padrão. Aguarde...' });
        try {
            const batch = writeBatch(db);
            defaultServices.forEach(service => {
                const docRef = doc(servicosRef);
                batch.set(docRef, service);
            });
            await batch.commit();
            toast({ title: 'Catálogo de Serviços Criado!', description: 'A lista padrão foi cadastrada com sucesso.' });
        } catch (error) {
            console.error("Erro ao popular serviços:", error);
            toast({ variant: 'destructive', title: 'Erro na Inicialização', description: 'Não foi possível cadastrar a lista de serviços.' });
        }
    }
    setIsInitializing(false);
  }, [user, activeCompany, toast]);

  useEffect(() => {
    if (activeCompany) {
        initializeServicesIfNeeded();
    }
  }, [activeCompany, initializeServicesIfNeeded]);
  
  useEffect(() => {
    if (isInitializing || !user || !activeCompany) {
        return;
    };

    setLoading(true);
    const servicosRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/servicos`);
    const q = query(servicosRef, orderBy('codigo', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const servicosData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Servico));
        setServicos(servicosData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching servicos: ", error);
        toast({
            variant: "destructive",
            title: "Erro ao buscar serviços",
            description: "Não foi possível carregar a lista de serviços."
        });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [isInitializing, user, activeCompany, toast]);

  const handleOpenModal = (servico: Servico | null = null) => {
    setEditingServico(servico);
    setIsModalOpen(true);
  }

  const handleCloseModal = () => {
    setEditingServico(null);
    setIsModalOpen(false);
  }

  const handleDeleteServico = async (servicoId: string) => {
    if (!user || !activeCompany) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/servicos`, servicoId));
      toast({
        title: 'Serviço excluído!',
        description: 'O serviço foi removido com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir serviço',
      });
    }
  };

  const totalPages = Math.ceil(servicos.length / itemsPerPage);
  const paginatedServicos = servicos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  const isLoadingOrInitializing = loading || isInitializing;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cadastro de Serviços</h1>
        <Button onClick={() => handleOpenModal()} disabled={!activeCompany}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo Serviço
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Serviços Cadastrados</CardTitle>
          <CardDescription>Gerencie os serviços prestados pela empresa.</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoadingOrInitializing ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : servicos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <Wrench className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Nenhum serviço cadastrado</h3>
                <p className="text-muted-foreground mt-2">
                    {!activeCompany ? "Selecione uma empresa para começar." : 'Clique em "Novo Serviço" para começar.'}
                </p>
            </div>
          ) : (
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor Padrão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedServicos.map((servico) => (
                    <TableRow key={servico.id}>
                        <TableCell className="font-mono">{servico.codigo}</TableCell>
                        <TableCell className="font-medium">{servico.descricao}</TableCell>
                        <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(servico.valorPadrao)}</TableCell>
                        <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenModal(servico)}>
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
                                                Esta ação não pode ser desfeita. O serviço será permanentemente removido.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteServico(servico.id!)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
         <ServicoFormModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            userId={user.uid}
            companyId={activeCompany.id}
            servico={editingServico}
          />
      )}
    </div>
  );
}
