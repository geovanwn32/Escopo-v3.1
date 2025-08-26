
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
import { Loader2, Save } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '../ui/textarea';
import type { Servico } from '@/types/servico';

interface ServicoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  servico: Servico | null;
}

const servicoSchema = z.object({
  codigo: z.string().min(1, "Código (Item da LC 116) é obrigatório"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valorPadrao: z.string().transform(v => String(v).replace(',', '.')).pipe(z.coerce.number().min(0, "Valor deve ser positivo")),
});

const defaultValues = {
    codigo: '',
    descricao: '',
    valorPadrao: 0,
};

export function ServicoFormModal({ isOpen, onClose, userId, companyId, servico }: ServicoFormModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const modalKey = servico?.id || 'new-servico';

  const form = useForm<z.infer<typeof servicoSchema>>({
    resolver: zodResolver(servicoSchema),
  });

  const mode = servico ? 'edit' : 'create';

  useEffect(() => {
    if (isOpen) {
        if (servico) {
            form.reset({
                ...servico,
                valorPadrao: String(servico.valorPadrao),
            });
        } else {
            form.reset({
                ...defaultValues,
                valorPadrao: String(defaultValues.valorPadrao),
            });
        }
    }
  }, [isOpen, servico, form]);


  const onSubmit = async (values: z.infer<typeof servicoSchema>) => {
    setLoading(true);
    try {
      const dataToSave = { ...values };
      
      if (mode === 'create') {
        const servicosRef = collection(db, `users/${userId}/companies/${companyId}/servicos`);
        await addDoc(servicosRef, dataToSave);
        toast({
          title: "Serviço Cadastrado!",
          description: `O serviço foi adicionado com sucesso.`,
        });
      } else if (servico?.id) {
        const servicoRef = doc(db, `users/${userId}/companies/${companyId}/servicos`, servico.id);
        await setDoc(servicoRef, dataToSave);
        toast({
          title: "Serviço Atualizado!",
          description: `Os dados do serviço foram atualizados.`,
        });
      }
      
      onClose();
    } catch (error) {
        console.error("Error saving service:", error);
        toast({
            variant: "destructive",
            title: "Erro ao salvar",
            description: "Não foi possível salvar os dados do serviço."
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl" key={modalKey}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Cadastro de Novo Serviço' : 'Alterar Serviço'}</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para cadastrar ou editar um serviço.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="codigo" render={({ field }) => ( <FormItem><FormLabel>Item LC 116</FormLabel><FormControl><Input {...field} placeholder="Ex: 01.01"/></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="valorPadrao" render={({ field }) => ( <FormItem><FormLabel>Valor Padrão (R$)</FormLabel><FormControl><Input {...field} onChange={e => {
                        const { value } = e.target;
                        e.target.value = value.replace(/[^0-9,.]/g, '').replace('.', ',');
                        field.onChange(e);
                    }} /></FormControl><FormMessage /></FormItem> )} />
            </div>
            <FormField control={form.control} name="descricao" render={({ field }) => ( <FormItem><FormLabel>Descrição Completa do Serviço</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />

            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Save />}
                {mode === 'create' ? 'Salvar Serviço' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
