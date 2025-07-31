
"use client";

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ContaContabil } from '@/types/conta-contabil';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface ContaBancariaSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (bankAccountId: string, expenseAccountId: string, revenueAccountId: string) => void;
  userId: string;
  companyId: string;
}

const formSchema = z.object({
  bankAccountId: z.string().min(1, 'Selecione a conta bancária de origem/destino.'),
  expenseAccountId: z.string().min(1, 'Selecione uma conta padrão para despesas.'),
  revenueAccountId: z.string().min(1, 'Selecione uma conta padrão para receitas.'),
});

type FormData = z.infer<typeof formSchema>;

export function ContaBancariaSelectionModal({ isOpen, onClose, onConfirm, userId, companyId }: ContaBancariaSelectionModalProps) {
  const [loading, setLoading] = useState(true);
  const [contas, setContas] = useState<ContaContabil[]>([]);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!isOpen) return;

    const fetchContas = async () => {
      setLoading(true);
      try {
        const contasRef = collection(db, `users/${userId}/companies/${companyId}/contasContabeis`);
        const q = query(contasRef, where('tipo', '==', 'analitica'));
        const snapshot = await getDocs(q);
        const contasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContaContabil));
        setContas(contasData);
      } catch (error) {
        console.error("Error fetching accounts:", error);
        toast({ variant: "destructive", title: "Erro ao buscar contas" });
      } finally {
        setLoading(false);
      }
    };
    fetchContas();
  }, [isOpen, userId, companyId, toast]);

  const onSubmit = (values: FormData) => {
    onConfirm(values.bankAccountId, values.expenseAccountId, values.revenueAccountId);
  };

  const contasAtivo = contas.filter(c => c.natureza === 'ativo');
  const contasDespesa = contas.filter(c => c.natureza === 'despesa');
  const contasReceita = contas.filter(c => c.natureza === 'receita');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contabilizar Lançamentos</DialogTitle>
          <DialogDescription>
            Selecione a conta bancária de origem e as contas padrão para classificar as receitas e despesas. Você poderá reclassificar os lançamentos individualmente mais tarde.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField control={form.control} name="bankAccountId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta Bancária</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione a conta do extrato..." /></SelectTrigger></FormControl>
                    <SelectContent>{contasAtivo.map(c => <SelectItem key={c.id} value={c.id!}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="revenueAccountId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta Padrão para Receitas</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione a conta de receita..." /></SelectTrigger></FormControl>
                    <SelectContent>{contasReceita.map(c => <SelectItem key={c.id} value={c.id!}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="expenseAccountId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta Padrão para Despesas</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione a conta de despesa..." /></SelectTrigger></FormControl>
                    <SelectContent>{contasDespesa.map(c => <SelectItem key={c.id} value={c.id!}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button type="submit">Confirmar e Contabilizar</Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
