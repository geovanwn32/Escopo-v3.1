
"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import type { AccountingEntry } from '@/app/(app)/contabil/page';

interface SimpleEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit' | 'view';
  entry: AccountingEntry | null;
  userId: string;
  companyId: string;
}

const formSchema = z.object({
  date: z.string().nonempty("A data é obrigatória."),
  debitAccount: z.string().min(3, "A conta de débito é obrigatória."),
  creditAccount: z.string().min(3, "A conta de crédito é obrigatória."),
  value: z.preprocess(
    (val) => String(val).replace(/\./g, '').replace(',', '.'),
    z.string().transform(Number).pipe(z.number().positive("O valor deve ser maior que zero."))
  ),
  description: z.string().min(5, "A descrição é obrigatória."),
});

type FormData = z.infer<typeof formSchema>;

export function SimpleEntryModal({ isOpen, onClose, mode, entry, userId, companyId }: SimpleEntryModalProps) {
  const { toast } = useToast();
  const isReadOnly = mode === 'view';

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      debitAccount: '',
      creditAccount: '',
      value: 0,
      description: ''
    }
  });

  useEffect(() => {
    if (entry) {
        form.reset({
            date: entry.date.toISOString().split('T')[0],
            debitAccount: entry.debitAccount,
            creditAccount: entry.creditAccount,
            value: entry.value,
            description: entry.description,
        });
    } else {
        form.reset({
            date: new Date().toISOString().split('T')[0],
            debitAccount: '',
            creditAccount: '',
            value: 0,
            description: ''
        });
    }
  }, [entry, form, isOpen]);

  const onSubmit = async (data: FormData) => {
    try {
        const dataToSave = {
            ...data,
            date: new Date(data.date),
            updatedAt: serverTimestamp()
        };

        if (mode === 'create') {
            const entriesRef = collection(db, `users/${userId}/companies/${companyId}/accountingEntries`);
            await addDoc(entriesRef, { ...dataToSave, createdAt: serverTimestamp() });
            toast({ title: "Lançamento criado com sucesso!" });
        } else if (mode === 'edit' && entry) {
            const entryRef = doc(db, `users/${userId}/companies/${companyId}/accountingEntries`, entry.id);
            await updateDoc(entryRef, dataToSave);
            toast({ title: "Lançamento atualizado com sucesso!" });
        }
        onClose();
    } catch (error) {
        console.error("Error saving accounting entry: ", error);
        toast({ variant: 'destructive', title: "Erro ao salvar lançamento", description: "Tente novamente mais tarde." });
    }
  }

  const getTitle = () => {
    switch (mode) {
      case 'create': return 'Criar Lançamento Simples';
      case 'edit': return 'Alterar Lançamento';
      case 'view': return 'Visualizar Lançamento';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>Preencha as informações para o lançamento contábil.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Data</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} readOnly={isReadOnly} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="value"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Valor (R$)</FormLabel>
                                <FormControl>
                                    <Input 
                                      {...field} 
                                      onChange={(e) => {
                                        const { value } = e.target;
                                        const onlyNums = value.replace(/[^0-9]/g, '');
                                        const intValue = parseInt(onlyNums, 10) || 0;
                                        const formattedValue = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(intValue / 100);
                                        field.onChange(formattedValue);
                                      }}
                                      value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(field.value)}
                                      readOnly={isReadOnly} 
                                      className="text-right"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="debitAccount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Conta de Débito</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: Caixa" {...field} readOnly={isReadOnly} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="creditAccount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Conta de Crédito</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: Receita de Vendas" {...field} readOnly={isReadOnly} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Histórico (Descrição)</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Ex: Venda de mercadorias para o cliente X" {...field} readOnly={isReadOnly} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onClose}>
                        {mode === 'view' ? 'Fechar' : 'Cancelar'}
                    </Button>
                    {mode !== 'view' && (
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Lançamento
                        </Button>
                    )}
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

