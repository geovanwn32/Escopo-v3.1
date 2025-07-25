
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Percent, MoreHorizontal, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, Landmark, Map, Globe } from "lucide-react";
import { AliquotaFormModal } from '@/components/aliquotas/aliquota-form-modal';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import type { Aliquota, EsferaTributaria } from '@/types/aliquota';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

export default function AliquotasPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAliquota, setEditingAliquota] = useState<Aliquota | null>(null);
  const [aliquotas, setAliquotas] = useState<Aliquota[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [modalEsfera, setModalEsfera] = useState<EsferaTributaria>('federal');

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
        setAliquotas([]);
        return;
    };

    setLoading(true);
    const aliquotasRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/aliquotas`);
    const q = query(aliquotasRef, orderBy('nomeDoImposto', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const aliquotasData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Aliquota));
        setAliquotas(aliquotasData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching aliquotas: ", error);
        toast({
            variant: "destructive",
            title: "Erro ao buscar alíquotas",
            description: "Não foi possível carregar a lista de alíquotas."
        });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeCompany, toast]);

  const handleOpenModal = (esfera: EsferaTributaria, aliquota: Aliquota | null = null) => {
    setModalEsfera(esfera);
    setEditingAliquota(aliquota);
    setIsModalOpen(true);
  }

  const handleCloseModal = () => {
    setEditingAliquota(null);
    setIsModalOpen(false);
  }

  const handleDeleteAliquota = async (aliquotaId: string) => {
    if (!user || !activeCompany) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/aliquotas`, aliquotaId));
      toast({
        title: 'Alíquota excluída!',
        description: 'A alíquota foi removida com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir alíquota',
      });
    }
  };

  const totalPages = Math.ceil(aliquotas.length / itemsPerPage);
  const paginatedAliquotas = aliquotas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  const getEsferaVariant = (esfera: EsferaTributaria): "default" | "secondary" | "outline" => {
    switch(esfera) {
        case 'municipal': return 'default';
        case 'estadual': return 'secondary';
        case 'federal': return 'outline';
        default: return 'default';
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cadastro de Alíquotas</h1>
         <div className="flex gap-2">
            <Button onClick={() => handleOpenModal('federal')} disabled={!activeCompany}>
              <Globe className="mr-2 h-4 w-4" /> Novo Imposto Federal
            </Button>
            <Button onClick={() => handleOpenModal('estadual')} disabled={!activeCompany} className="bg-green-600 hover:bg-green-700 text-white">
              <Map className="mr-2 h-4 w-4" /> Novo Imposto Estadual
            </Button>
            <Button onClick={() => handleOpenModal('municipal')} disabled={!activeCompany} className="bg-yellow-500 hover:bg-yellow-600 text-black">
              <Landmark className="mr-2 h-4 w-4" /> Novo Imposto Municipal
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Alíquotas Cadastradas</CardTitle>
          <CardDescription>Gerencie as alíquotas de impostos aqui.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : aliquotas.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <Percent className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Nenhuma alíquota cadastrada</h3>
                 <p className="text-muted-foreground mt-2">
                    {!activeCompany ? "Selecione uma empresa para começar." : 'Clique em um dos botões acima para começar.'}
                </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Esfera</TableHead>
                  <TableHead>Imposto</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Alíquota (%)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAliquotas.map((aliquota) => (
                  <TableRow key={aliquota.id}>
                    <TableCell>
                        <Badge variant={getEsferaVariant(aliquota.esfera)} className="capitalize">{aliquota.esfera}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{aliquota.nomeDoImposto}</TableCell>
                    <TableCell className="text-muted-foreground">{aliquota.descricao}</TableCell>
                    <TableCell className="text-right font-mono">{aliquota.aliquota.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenModal(aliquota.esfera, aliquota)}>
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
                                            Esta ação não pode ser desfeita. A alíquota será permanentemente removida.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteAliquota(aliquota.id!)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
      {isModalOpen && user && activeCompany && (
         <AliquotaFormModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            userId={user.uid}
            companyId={activeCompany.id}
            aliquota={editingAliquota}
            esfera={modalEsfera}
          />
      )}
    </div>
  );
}
