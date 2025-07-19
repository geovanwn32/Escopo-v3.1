
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, MoreHorizontal, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { RubricaFormModal } from '@/components/pessoal/rubrica-form-modal';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/app/(app)/fiscal/page';
import type { Rubrica } from '@/types/rubrica';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

export default function RubricasPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRubrica, setEditingRubrica] = useState<Rubrica | null>(null);
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
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
        setRubricas([]);
        return;
    };

    setLoading(true);
    const rubricasRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/rubricas`);
    const q = query(rubricasRef, orderBy('codigo', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const rubricasData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Rubrica));
        setRubricas(rubricasData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching rubricas: ", error);
        toast({
            variant: "destructive",
            title: "Erro ao buscar rubricas",
            description: "Não foi possível carregar a lista de rubricas."
        });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeCompany, toast]);

  const handleOpenModal = (rubrica: Rubrica | null = null) => {
    setEditingRubrica(rubrica);
    setIsModalOpen(true);
  }

  const handleCloseModal = () => {
    setEditingRubrica(null);
    setIsModalOpen(false);
  }

  const handleDeleteRubrica = async (rubricaId: string) => {
    if (!user || !activeCompany) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/rubricas`, rubricaId));
      toast({
        title: 'Rubrica excluída!',
        description: 'A rubrica foi removida com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir rubrica',
      });
    }
  };

  const totalPages = Math.ceil(rubricas.length / itemsPerPage);
  const paginatedRubricas = rubricas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cadastro de Rubricas</h1>
        <Button onClick={() => handleOpenModal()} disabled={!activeCompany}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Rubrica
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Rubricas Cadastradas</CardTitle>
          <CardDescription>Gerencie os eventos (proventos e descontos) para a folha de pagamento.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : rubricas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                  <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhuma rubrica cadastrada</h3>
              <p className="text-muted-foreground mt-2">
                {!activeCompany ? "Selecione uma empresa para começar." : 'Clique em "Nova Rubrica" para começar.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Incidências</TableHead>
                   <TableHead>Natureza eSocial</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRubricas.map((rubrica) => (
                  <TableRow key={rubrica.id}>
                    <TableCell className="font-mono">{rubrica.codigo}</TableCell>
                    <TableCell className="font-medium">{rubrica.descricao}</TableCell>
                    <TableCell>
                        <Badge variant={rubrica.tipo === 'provento' ? 'default' : 'destructive'}>
                            {rubrica.tipo.charAt(0).toUpperCase() + rubrica.tipo.slice(1)}
                        </Badge>
                    </TableCell>
                    <TableCell className="space-x-1">
                        {rubrica.incideINSS && <Badge variant="outline">INSS</Badge>}
                        {rubrica.incideFGTS && <Badge variant="outline">FGTS</Badge>}
                        {rubrica.incideIRRF && <Badge variant="outline">IRRF</Badge>}
                    </TableCell>
                    <TableCell className="font-mono">{rubrica.naturezaESocial}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenModal(rubrica)}>
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
                                            Esta ação não pode ser desfeita. A rubrica será permanentemente removida.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteRubrica(rubrica.id!)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
         <RubricaFormModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            userId={user.uid}
            companyId={activeCompany.id}
            rubrica={editingRubrica}
          />
      )}
    </div>
  );
}
