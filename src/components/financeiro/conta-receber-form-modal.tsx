
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import type { ContaReceber } from '@/types/conta-receber';
import type { Partner } from '@/types/partner';
import { Textarea } from '../ui/textarea';

interface ContaReceberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  conta: ContaReceber | null;
  parceiros: Partner[];
}

const formSchema = z.object({
  partnerId: z.string().min(1, "Selecione um cliente."),
  description: z.string().min(1, "A descrição é obrigatória."),
  issueDate: z.date({ required_error: "A data de emissão é obrigatória." }),
  dueDate: z.date({ required_error: "A data de vencimento é obrigatória." }),
  value: z.string().transform(v => String(v).replace(',', '.')).pipe(z.coerce.number().min(0.01, "O valor deve ser maior que zero.")),
  status: z.enum(['aberta', 'paga', 'vencida', 'cancelada']),
});

type FormData = z.infer<typeof formSchema>;

export function ContaReceberFormModal({ isOpen, onClose, userId, companyId, conta, parceiros }: ContaReceberFormModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const modalKey = conta?.id || 'new-conta-receber';
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: conta ? {
        ...conta,
        value: String(conta.value),
    } : {
        partnerId: '',
        description: '',
        issueDate: new Date(),
        dueDate: new Date(),
        value: 0,
        status: 'aberta',
    },
  });

  const mode = conta ? 'edit' : 'create';

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      const partnerName = parceiros.find(p => p.id === values.partnerId)?.razaoSocial || 'N/A';
      const dataToSave = { 
          ...values, 
          partnerName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        };
      
      if (mode === 'create') {
        const contasRef = collection(db, `users/${userId}/companies/${companyId}/contasAReceber`);
        await addDoc(contasRef, dataToSave);
        toast({ title: "Lançamento Criado!" });
      } else if (conta?.id) {
        const contaRef = doc(db, `users/${userId}/companies/${companyId}/contasAReceber`, conta.id);
        delete (dataToSave as any).createdAt;
        await setDoc(contaRef, dataToSave, { merge: true });
        toast({ title: "Lançamento Atualizado!" });
      }
      onClose();
    } catch (error) {
        console.error("Error saving conta:", error);
        toast({ variant: "destructive", title: "Erro ao salvar lançamento." });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" key={modalKey}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nova Conta a Receber' : 'Editar Conta a Receber'}</DialogTitle>
          <DialogDescription>Preencha os dados do lançamento financeiro.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField control={form.control} name="partnerId" render={({ field }) => ( <FormItem><FormLabel>Cliente</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione o cliente..." /></SelectTrigger></FormControl><SelectContent>{parceiros.filter(p => p.type === 'cliente').map(p => <SelectItem key={p.id} value={p.id!}>{p.razaoSocial}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
             <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Descrição</FormLabel><FormControl><Textarea {...field} placeholder="Ex: Venda de mercadorias NF 123" /></FormControl><FormMessage /></FormItem> )} />
            
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="issueDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data de Emissão</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data de Vencimento</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <FormField control={form.control} name="value" render={({ field }) => ( <FormItem><FormLabel>Valor (R$)</FormLabel><FormControl><Input {...field} type="text" onChange={e => {
                      const { value } = e.target;
                      e.target.value = value.replace(/[^0-9,.]/g, '').replace('.', ',');
                      field.onChange(e);
                  }} /></FormControl><FormMessage /></FormItem> )} />
                 <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="aberta">Aberta</SelectItem><SelectItem value="paga">Paga</SelectItem><SelectItem value="vencida">Vencida</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
            
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Save />}
                {mode === 'create' ? 'Salvar Lançamento' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
