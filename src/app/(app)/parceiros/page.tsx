
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Handshake, MoreHorizontal, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, User, Truck, Building, Search, FilterX } from "lucide-react";
import { PartnerFormModal } from '@/components/parceiros/partner-form-modal';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import type { Partner, PartnerType } from '@/types/partner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ParceirosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [modalPartnerType, setModalPartnerType] = useState<PartnerType>('cliente');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<PartnerType | ''>('');

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
        setPartners([]);
        return;
    };

    setLoading(true);
    const partnersRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/partners`);
    const q = query(partnersRef, orderBy('razaoSocial', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const partnersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Partner));
        setPartners(partnersData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching partners: ", error);
        toast({
            variant: "destructive",
            title: "Erro ao buscar parceiros",
            description: "Não foi possível carregar a lista de parceiros."
        });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeCompany, toast]);

    const filteredPartners = useMemo(() => {
        return partners.filter(partner => {
            const searchTermLower = searchTerm.toLowerCase();
            const nameMatch = partner.razaoSocial.toLowerCase().includes(searchTermLower) || (partner.nomeFantasia || '').toLowerCase().includes(searchTermLower);
            const docMatch = partner.cpfCnpj.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''));
            const typeMatch = filterType ? partner.type === filterType : true;
            return (nameMatch || docMatch) && typeMatch;
        });
    }, [partners, searchTerm, filterType]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType]);


  const handleOpenModal = (type: PartnerType, partner: Partner | null = null) => {
    setModalPartnerType(type);
    setEditingPartner(partner);
    setIsModalOpen(true);
  }

  const handleCloseModal = () => {
    setEditingPartner(null);
    setIsModalOpen(false);
  }

  const handleDeletePartner = async (partnerId: string) => {
    if (!user || !activeCompany) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/partners`, partnerId));
      toast({
        title: 'Parceiro excluído!',
        description: 'O parceiro foi removido com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir parceiro',
      });
    }
  };

  const totalPages = Math.ceil(filteredPartners.length / itemsPerPage);
  const paginatedPartners = filteredPartners.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatCpfCnpj = (value?: string, tipoPessoa?: 'pf' | 'pj') => {
    if (!value) return '';
    const cleaned = value.replace(/\D/g, '');
    
    if ((tipoPessoa === 'pf' || cleaned.length <= 11)) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };
  
  const getTypeVariant = (type: PartnerType): "default" | "secondary" | "outline" => {
    switch(type) {
        case 'cliente': return 'default';
        case 'fornecedor': return 'secondary';
        case 'transportadora': return 'outline';
        default: return 'default';
    }
  }
  
  const getRegimeLabel = (regime?: Partner['regimeTributario']): string => {
    if (!regime) return '-';
    const labels = {
        simples: 'Simples Nacional',
        presumido: 'Lucro Presumido',
        real: 'Lucro Real',
        mei: 'MEI',
    };
    return labels[regime] || '-';
  }

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('');
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cadastro de Parceiros</h1>
        <div className="flex gap-2">
            <Button onClick={() => handleOpenModal('cliente')} disabled={!activeCompany}>
              <User className="mr-2 h-4 w-4" /> Novo Cliente
            </Button>
            <Button onClick={() => handleOpenModal('fornecedor')} disabled={!activeCompany} className="bg-green-600 hover:bg-green-700 text-white">
              <Building className="mr-2 h-4 w-4" /> Novo Fornecedor
            </Button>
            <Button onClick={() => handleOpenModal('transportadora')} disabled={!activeCompany} className="bg-yellow-500 hover:bg-yellow-600 text-black">
              <Truck className="mr-2 h-4 w-4" /> Nova Transportadora
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Parceiros Cadastrados</CardTitle>
          <CardDescription>Gerencie seus clientes, fornecedores e transportadoras.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50 items-center">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filtrar por nome ou CPF/CNPJ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                 <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar por Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="cliente">Cliente</SelectItem>
                        <SelectItem value="fornecedor">Fornecedor</SelectItem>
                        <SelectItem value="transportadora">Transportadora</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="ghost" onClick={clearFilters} className="sm:ml-auto">
                    <FilterX className="mr-2 h-4 w-4" />
                    Limpar Filtros
                </Button>
            </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : partners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                  <Handshake className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhum parceiro cadastrado</h3>
              <p className="text-muted-foreground mt-2">
                {!activeCompany ? "Selecione uma empresa para começar." : 'Clique em um dos botões acima para começar.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome Fantasia / Nome</TableHead>
                  <TableHead>CPF / CNPJ</TableHead>
                  <TableHead>Regime Tributário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPartners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium max-w-xs truncate">{partner.nomeFantasia || partner.razaoSocial}</TableCell>
                    <TableCell>{formatCpfCnpj(partner.cpfCnpj, partner.tipoPessoa)}</TableCell>
                    <TableCell>{getRegimeLabel(partner.regimeTributario)}</TableCell>
                    <TableCell>
                      <Badge variant={getTypeVariant(partner.type)} className="capitalize">{partner.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenModal(partner.type, partner)}>
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
                                            Esta ação não pode ser desfeita. O parceiro será permanentemente removido.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeletePartner(partner.id!)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
         <PartnerFormModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            userId={user.uid}
            companyId={activeCompany.id}
            partner={editingPartner}
            partnerType={modalPartnerType}
          />
      )}
    </div>
  );
}
