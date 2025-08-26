
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
import type { Produto } from '@/types/produto';

interface ProdutoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  produto: Produto | null;
}

const produtoSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  ncm: z.string().length(8, "NCM deve ter 8 dígitos."),
  cfop: z.string().length(4, "CFOP deve ter 4 dígitos."),
  valorUnitario: z.string().transform(v => String(v).replace(',', '.')).pipe(z.coerce.number().min(0, "Valor deve ser positivo")),
});

const defaultValues = {
    codigo: '',
    descricao: '',
    ncm: '',
    cfop: '',
    valorUnitario: 0,
};

export function ProdutoFormModal({ isOpen, onClose, userId, companyId, produto }: ProdutoFormModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const modalKey = produto?.id || 'new-produto';
  
  const form = useForm<z.infer<typeof produtoSchema>>({
    resolver: zodResolver(produtoSchema),
    defaultValues: {
        ...defaultValues,
        valorUnitario: String(defaultValues.valorUnitario),
    },
  });

  const mode = produto ? 'edit' : 'create';

  useEffect(() => {
    if (isOpen) {
        if (produto) {
            form.reset({
                ...produto,
                valorUnitario: String(produto.valorUnitario),
            });
        } else {
            form.reset({
                ...defaultValues,
                valorUnitario: String(defaultValues.valorUnitario),
            });
        }
    }
  }, [isOpen, produto, form]);


  const onSubmit = async (values: z.infer<typeof produtoSchema>) => {
    setLoading(true);
    try {
      const dataToSave = { ...values };
      
      if (mode === 'create') {
        const produtosRef = collection(db, `users/${userId}/companies/${companyId}/produtos`);
        await addDoc(produtosRef, dataToSave);
        toast({
          title: "Produto Cadastrado!",
          description: `O produto foi adicionado com sucesso.`,
        });
      } else if (produto?.id) {
        const produtoRef = doc(db, `users/${userId}/companies/${companyId}/produtos`, produto.id);
        await setDoc(produtoRef, dataToSave);
        toast({
          title: "Produto Atualizado!",
          description: `Os dados do produto foram atualizados.`,
        });
      }
      
      onClose();
    } catch (error) {
        console.error("Error saving product:", error);
        toast({
            variant: "destructive",
            title: "Erro ao salvar",
            description: "Não foi possível salvar os dados do produto."
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" key={modalKey}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Cadastro de Novo Produto' : 'Alterar Produto'}</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para cadastrar ou editar um produto.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
             <FormField control={form.control} name="descricao" render={({ field }) => ( <FormItem><FormLabel>Descrição do Produto</FormLabel><FormControl><Input {...field} autoFocus /></FormControl><FormMessage /></FormItem> )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="codigo" render={({ field }) => ( <FormItem><FormLabel>Código/SKU</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="valorUnitario" render={({ field }) => ( <FormItem><FormLabel>Valor Unitário (R$)</FormLabel><FormControl><Input {...field} onChange={e => {
                        const { value } = e.target;
                        e.target.value = value.replace(/[^0-9,.]/g, '').replace('.', ',');
                        field.onChange(e);
                    }} /></FormControl><FormMessage /></FormItem> )} />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="ncm" render={({ field }) => ( <FormItem><FormLabel>NCM</FormLabel><FormControl><Input {...field} maxLength={8} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="cfop" render={({ field }) => ( <FormItem><FormLabel>CFOP</FormLabel><FormControl><Input {...field} maxLength={4} /></FormControl><FormMessage /></FormItem> )} />
            </div>

            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Save />}
                {mode === 'create' ? 'Salvar Produto' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
