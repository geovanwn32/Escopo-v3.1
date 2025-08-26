
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
import type { Aliquota, EsferaTributaria } from '@/types/aliquota';

interface AliquotaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  aliquota: Aliquota | null;
  esfera: EsferaTributaria;
}

const aliquotaSchema = z.object({
  esfera: z.enum(['municipal', 'estadual', 'federal']),
  nomeDoImposto: z.string().min(1, "O nome do imposto é obrigatório."),
  descricao: z.string().min(1, "A descrição é obrigatória."),
  aliquota: z.string().transform(v => String(v).replace(',', '.')).pipe(z.coerce.number().min(0, "A alíquota deve ser um valor positivo.")),
  itemLc: z.string().optional(),
});

type FormData = z.infer<typeof aliquotaSchema>;

function AliquotaForm({ userId, companyId, aliquota, esfera, onClose }: Omit<AliquotaFormModalProps, 'isOpen'>) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const mode = aliquota ? 'edit' : 'create';
  
  const form = useForm<FormData>({
    resolver: zodResolver(aliquotaSchema),
  });

  useEffect(() => {
    if(mode === 'create') {
        form.reset({
          esfera: esfera,
          nomeDoImposto: '',
          descricao: '',
          aliquota: 0,
          itemLc: '',
        });
    } else if (aliquota) {
        form.reset({
          ...aliquota,
          aliquota: String(aliquota.aliquota || 0),
        });
    }
  }, [aliquota, esfera, mode, form]);

  const title = {
    municipal: 'Imposto Municipal',
    estadual: 'Imposto Estadual',
    federal: 'Imposto Federal',
  }[esfera];


  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      const dataToSave = { ...values };
      
      if (mode === 'create') {
        const aliquotasRef = collection(db, `users/${userId}/companies/${companyId}/aliquotas`);
        await addDoc(aliquotasRef, dataToSave);
        toast({ title: "Alíquota Cadastrada!", description: `A alíquota foi adicionada com sucesso.` });
      } else if (aliquota?.id) {
        const aliquotaRef = doc(db, `users/${userId}/companies/${companyId}/aliquotas`, aliquota.id);
        await setDoc(aliquotaRef, dataToSave, { merge: true });
        toast({ title: "Alíquota Atualizada!", description: `Os dados da alíquota foram atualizados.` });
      }
      onClose();
    } catch (error) {
        console.error("Error saving aliquota:", error);
        toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível salvar os dados da alíquota." });
    } finally {
        setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? `Nova Alíquota (${title})` : `Editar Alíquota (${title})`}</DialogTitle>
        <DialogDescription>Preencha os dados do imposto abaixo.</DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField control={form.control} name="nomeDoImposto" render={({ field }) => ( <FormItem><FormLabel>Nome do Imposto</FormLabel><FormControl><Input {...field} placeholder={esfera === 'municipal' ? 'Ex: ISS' : esfera === 'estadual' ? 'Ex: ICMS' : 'Ex: PIS'} /></FormControl><FormMessage /></FormItem> )} />
          <FormField control={form.control} name="descricao" render={({ field }) => ( <FormItem><FormLabel>Descrição</FormLabel><FormControl><Input {...field} placeholder={esfera === 'municipal' ? 'Ex: ISS sobre serviço de TI - Goiânia' : 'Ex: ICMS Alíquota Interna'} /></FormControl><FormMessage /></FormItem> )} />
          
          <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="aliquota" render={({ field }) => ( <FormItem><FormLabel>Alíquota (%)</FormLabel><FormControl><Input {...field} type="text" onChange={e => {
                          const { value } = e.target;
                          e.target.value = value.replace(/[^0-9,.]/g, '').replace('.', ',');
                          field.onChange(e);
                      }} /></FormControl><FormMessage /></FormItem> )} />

              {esfera === 'municipal' && (
                  <FormField control={form.control} name="itemLc" render={({ field }) => ( <FormItem><FormLabel>Item LC 116</FormLabel><FormControl><Input {...field} placeholder="Ex: 01.01" /></FormControl><FormMessage /></FormItem> )} />
              )}
          </div>

          <DialogFooter className="pt-6">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Save />}
              {mode === 'create' ? 'Salvar Alíquota' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}


export function AliquotaFormModal({ isOpen, onClose, ...props }: AliquotaFormModalProps) {
  const modalKey = `${props.aliquota?.id || 'new'}-${props.esfera}`;
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl" key={modalKey}>
        <AliquotaForm onClose={onClose} {...props} />
      </DialogContent>
    </Dialog>
  );
}
