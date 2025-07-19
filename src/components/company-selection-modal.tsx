"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Building, Trash2, Edit } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

const companySchema = z.object({
  nomeFantasia: z.string().min(1, "Nome Fantasia é obrigatório."),
  razaoSocial: z.string().min(1, "Razão Social é obrigatória."),
  cnpj: z.string().length(18, "CNPJ deve ter 14 dígitos.").transform(val => val.replace(/[^\d]/g, '')),
});


export function CompanySelectionModal({ isOpen, onClose, onCompanySelect, userId }: { isOpen: boolean; onClose: () => void; onCompanySelect: (company: any) => void; userId: string; }) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
  });

  const fetchCompanies = async () => {
    if (!userId) return;
    setLoading(true);
    const companiesRef = collection(db, `users/${userId}/companies`);
    const snapshot = await getDocs(companiesRef);
    setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
      setIsCreating(false);
      setEditingCompany(null);
    }
  }, [isOpen, userId]);

  const handleCreateOrUpdateCompany = async (values: z.infer<typeof companySchema>) => {
    try {
      if (editingCompany) {
        const companyRef = doc(db, `users/${userId}/companies`, editingCompany.id);
        await setDoc(companyRef, values, { merge: true });
        toast({ title: "Empresa atualizada com sucesso!" });
      } else {
        const companiesRef = collection(db, `users/${userId}/companies`);
        await addDoc(companiesRef, values);
        toast({ title: "Empresa criada com sucesso!" });
      }
      form.reset();
      setIsCreating(false);
      setEditingCompany(null);
      fetchCompanies();
    } catch (error) {
      toast({ variant: 'destructive', title: "Erro ao salvar empresa", description: "Tente novamente." });
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

  const handleEdit = (company: any) => {
    setEditingCompany(company);
    form.reset({
        nomeFantasia: company.nomeFantasia,
        razaoSocial: company.razaoSocial,
        cnpj: company.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"),
    });
    setIsCreating(true);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isCreating || editingCompany ? 'Cadastro de Empresa' : 'Selecione uma Empresa'}</DialogTitle>
          <DialogDescription>
            {isCreating || editingCompany ? 'Preencha os dados da nova empresa.' : 'Escolha uma empresa para continuar ou cadastre uma nova.'}
          </DialogDescription>
        </DialogHeader>

        {isCreating || editingCompany ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateOrUpdateCompany)} className="space-y-4 py-4">
              <FormField control={form.control} name="nomeFantasia" render={({ field }) => (<FormItem><FormLabel>Nome Fantasia</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="razaoSocial" render={({ field }) => (<FormItem><FormLabel>Razão Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="cnpj" render={({ field }) => (<FormItem><FormLabel>CNPJ</FormLabel><FormControl><Input {...field} onChange={(e) => {
                const { value } = e.target;
                e.target.value = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
                field.onChange(e);
              }} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { setIsCreating(false); setEditingCompany(null); }}>Cancelar</Button>
                <Button type="submit">Salvar Empresa</Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="py-4">
            {loading ? (
              <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin" /></div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                {companies.map(company => (
                  <div key={company.id} className="flex items-center gap-2 rounded-lg border p-3 hover:bg-accent transition-colors">
                    <div className="flex-1 cursor-pointer" onClick={() => onCompanySelect(company)}>
                        <p className="font-semibold">{company.nomeFantasia}</p>
                        <p className="text-sm text-muted-foreground">{company.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(company)}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita e irá remover todos os dados associados a esta empresa.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteCompany(company.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
                 {companies.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma empresa encontrada.</p>}
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button onClick={() => { setIsCreating(true); setEditingCompany(null); form.reset(); }} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Cadastrar Nova Empresa
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
