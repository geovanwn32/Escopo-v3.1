
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Plus } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ContaContabil } from '@/types/conta-contabil';
import { Textarea } from '../ui/textarea';

interface ContaContabilFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  conta: ContaContabil | null;
}

const contaSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório."),
  nome: z.string().min(1, "Nome da conta é obrigatório."),
  descricao: z.string().optional(),
  tipo: z.enum(['sintetica', 'analitica'], { required_error: "O tipo é obrigatório." }),
  natureza: z.enum(['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa'], { required_error: "A natureza é obrigatória." }),
});

type FormData = z.infer<typeof contaSchema>;

const defaultValues: FormData = {
    codigo: '',
    nome: '',
    descricao: '',
    tipo: 'analitica',
    natureza: 'despesa',
};

export function ContaContabilFormModal({ isOpen, onClose, userId, companyId, conta }: ContaContabilFormModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const modalKey = conta?.id || 'new-conta';
  
  const form = useForm<FormData>({
    resolver: zodResolver(contaSchema),
  });

  const mode = conta ? 'edit' : 'create';

  useEffect(() => {
    if (isOpen) {
      if (conta) {
        form.reset({
            ...conta,
            natureza: conta.natureza.replace(' ', '_') as FormData['natureza'],
        });
      } else {
        form.reset(defaultValues);
      }
    }
  }, [isOpen, conta, form]);

  const onSubmit = async (values: FormData, andClose: boolean) => {
    setLoading(true);
    try {
      const dataToSave = { ...values };
      
      if (mode === 'create') {
        const contasRef = collection(db, `users/${userId}/companies/${companyId}/contasContabeis`);
        await addDoc(contasRef, dataToSave);
        toast({ title: "Conta Cadastrada!", description: `A conta ${values.nome} foi adicionada.` });
      } else if (conta?.id) {
        const contaRef = doc(db, `users/${userId}/companies/${companyId}/contasContabeis`, conta.id);
        await setDoc(contaRef, dataToSave, { merge: true });
        toast({ title: "Conta Atualizada!", description: `Os dados da conta ${values.nome} foram atualizados.` });
      }

      if(andClose) {
          onClose();
      } else if (mode === 'create') {
          form.reset(defaultValues);
      }
    } catch (error) {
        console.error("Error saving conta:", error);
        toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível salvar os dados da conta." });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl" key={modalKey}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nova Conta Contábil' : 'Editar Conta Contábil'}</DialogTitle>
          <DialogDescription>Preencha os dados da conta abaixo.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="codigo" render={({ field }) => ( <FormItem><FormLabel>Código</FormLabel><FormControl><Input {...field} placeholder="1.01.01.001" /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="nome" render={({ field }) => ( <FormItem><FormLabel>Nome da Conta</FormLabel><FormControl><Input {...field} placeholder="Caixa" /></FormControl><FormMessage /></FormItem> )} />
            </div>
             <FormField control={form.control} name="descricao" render={({ field }) => ( <FormItem><FormLabel>Descrição (Opcional)</FormLabel><FormControl><Textarea {...field} placeholder="Detalhes sobre a finalidade da conta..." /></FormControl><FormMessage /></FormItem> )} />
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="tipo" render={({ field }) => ( <FormItem><FormLabel>Tipo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="analitica">Analítica</SelectItem><SelectItem value="sintetica">Sintética</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="natureza" render={({ field }) => ( <FormItem><FormLabel>Natureza</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="passivo">Passivo</SelectItem><SelectItem value="patrimonio_liquido">Patrimônio Líquido</SelectItem><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
              {mode === 'create' && (
                <Button type="button" variant="outline" onClick={form.handleSubmit(v => onSubmit(v, false))} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : <Plus />}
                    Salvar e Novo
                </Button>
              )}
              <Button type="button" onClick={form.handleSubmit(v => onSubmit(v, true))} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Save />}
                {mode === 'create' ? 'Salvar e Fechar' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
