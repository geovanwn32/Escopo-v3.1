
"use client";

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Edit, Search, CheckCircle, Building2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Card, CardContent } from './ui/card';
import { createCompanyWithDefaults } from '@/services/company-creation-service';
import { doc, setDoc } from 'firebase/firestore';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { lookupCnpj } from '@/services/data-lookup-service';

const companySchema = z.object({
  nomeFantasia: z.string().min(1, "Nome Fantasia é obrigatório."),
  razaoSocial: z.string().min(1, "Razão Social é obrigatória."),
  cnpj: z.string().refine(val => val.replace(/\D/g, '').length === 14, "CNPJ deve ter 14 dígitos."),
});


export function CompanySelectionModal({ isOpen, onClose, onCompanySelect, userId }: { isOpen: boolean; onClose: () => void; onCompanySelect: (company: any) => void; userId: string; }) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      cnpj: '',
      razaoSocial: '',
      nomeFantasia: '',
    }
  });

  const fetchCompanies = async () => {
    if (!userId) return;
    setLoading(true);
    const companiesRef = collection(db, `users/${userId}/companies`);
    const q = query(companiesRef, orderBy('nomeFantasia', 'asc'));
    const snapshot = await getDocs(q);
    setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
      setIsCreating(false);
      setEditingCompany(null);
      setSearchTerm('');
    }
  }, [isOpen, userId]);

  const filteredCompanies = useMemo(() => {
    if (!searchTerm) return companies;
    return companies.filter(company =>
      company.nomeFantasia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.cnpj && company.cnpj.includes(searchTerm.replace(/\D/g, '')))
    );
  }, [companies, searchTerm]);
  
  const handleCnpjLookup = async () => {
    const cnpjValue = form.getValues('cnpj');
    if (cnpjValue.replace(/\D/g, '').length !== 14) {
      toast({ variant: 'destructive', title: 'A busca automática funciona apenas para CNPJ.' });
      return;
    }
    setLoadingCnpj(true);
    try {
        const data = await lookupCnpj(cnpjValue);
        form.setValue('razaoSocial', data.razaoSocial, { shouldValidate: true });
        form.setValue('nomeFantasia', data.nomeFantasia, { shouldValidate: true });
        toast({ title: 'Dados do CNPJ preenchidos!' });
    } catch (error) {
        console.error("Lookup failed:", error);
        toast({ variant: 'destructive', title: 'Erro ao buscar CNPJ', description: (error as Error).message });
    } finally {
        setLoadingCnpj(false);
    }
  };


  const handleCreateOrUpdateCompany = async (values: z.infer<typeof companySchema>) => {
    setIsSubmitting(true);
    try {
      const companyData = {
          ...values,
          cnpj: values.cnpj.replace(/\D/g, ''),
      };
      if (editingCompany) {
        // Handle update
        const companyRef = doc(db, `users/${userId}/companies`, editingCompany.id);
        await setDoc(companyRef, companyData, { merge: true });
        toast({ title: "Empresa atualizada com sucesso!" });
      } else {
        // Handle create
        await createCompanyWithDefaults(userId, companyData);
        toast({ title: "Empresa criada com sucesso!", description: "Um plano de contas padrão foi adicionado." });
      }
      form.reset({ cnpj: '', razaoSocial: '', nomeFantasia: ''});
      setIsCreating(false);
      setEditingCompany(null);
      await fetchCompanies();
    } catch (error) {
      console.error("Error saving company:", error);
      toast({ variant: 'destructive', title: "Erro ao salvar empresa", description: "Tente novamente." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    try {
        await deleteDoc(doc(db, `users/${userId}/companies`, companyId));
        toast({ title: "Empresa excluída com sucesso!" });
        fetchCompanies();
    } catch (error) {
        toast({ variant: 'destructive', title: "Erro ao excluir empresa" });
    }
  }

  const handleEdit = (e: React.MouseEvent, company: any) => {
    e.stopPropagation(); // Prevent card click
    setEditingCompany(company);
    form.reset({
        nomeFantasia: company.nomeFantasia,
        razaoSocial: company.razaoSocial,
        cnpj: company.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"),
    });
    setIsCreating(true);
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{isCreating || editingCompany ? 'Cadastro de Empresa' : 'Selecione uma Empresa'}</DialogTitle>
          <DialogDescription>
            {isCreating || editingCompany ? 'Preencha os dados da nova empresa.' : 'Escolha uma empresa para continuar ou cadastre uma nova.'}
          </DialogDescription>
        </DialogHeader>

        {isCreating || editingCompany ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateOrUpdateCompany)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          {...field}
                          onBlur={() => {
                            field.onBlur(); // Important to trigger validation
                            handleCnpjLookup();
                          }}
                          onChange={(e) => {
                            const { value } = e.target;
                            e.target.value = value
                              .replace(/\D/g, '')
                              .replace(/(\d{2})(\d)/, '$1.$2')
                              .replace(/(\d{3})(\d)/, '$1.$2')
                              .replace(/(\d{3})(\d)/, '$1/$2')
                              .replace(/(\d{4})(\d{2})/, '$1-$2')
                              .replace(/(-\d{2})\d+?$/, '$1');
                            field.onChange(e);
                          }}
                        />
                      </FormControl>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        {loadingCnpj ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="razaoSocial" render={({ field }) => (<FormItem><FormLabel>Razão Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="nomeFantasia" render={({ field }) => (<FormItem><FormLabel>Nome Fantasia</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { setIsCreating(false); setEditingCompany(null); }} disabled={isSubmitting}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Salvar Empresa
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="py-4 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Filtrar por nome ou CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-60"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto p-1">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredCompanies.length > 0 ? (
                      filteredCompanies.map(company => (
                          <Card 
                              key={company.id} 
                              className="group cursor-pointer hover:border-primary transition-all relative"
                              onClick={() => onCompanySelect(company)}
                          >
                              <CardContent className="p-4 flex flex-col justify-between h-full">
                                <div>
                                    <div className="absolute top-2 right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                         <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => handleEdit(e, company)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7" onClick={handleDeleteClick}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita e irá remover todos os dados associados a esta empresa.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel onClick={handleDeleteClick}>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={(e) => { e.stopPropagation(); handleDeleteCompany(company.id); }}>Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                    <Building2 className="w-8 h-8 text-muted-foreground mb-3" />
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-card-foreground truncate">{company.nomeFantasia}</p>
                                        <Badge variant={company.ativo === false ? 'secondary' : 'success'}>
                                            {company.ativo === false ? 'Inativa' : 'Ativa'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground font-mono">{company.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") || 'CNPJ não informado'}</p>
                                </div>
                                <Button className="w-full mt-4" variant="secondary" onClick={() => onCompanySelect(company)}>
                                  <CheckCircle className="mr-2 h-4 w-4"/>
                                  Selecionar
                                </Button>
                              </CardContent>
                          </Card>
                      ))
                  ) : (
                     <div className="col-span-full h-24 text-center flex justify-center items-center text-muted-foreground">
                          Nenhuma empresa encontrada.
                      </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button onClick={() => { setIsCreating(true); setEditingCompany(null); form.reset({ cnpj: '', razaoSocial: '', nomeFantasia: ''}); }} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Cadastrar Nova Empresa
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
