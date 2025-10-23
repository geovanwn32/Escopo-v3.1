
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Search } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DateInput } from '../ui/date-input';
import { Textarea } from '../ui/textarea';
import type { Company, Partner, Employee, Recibo } from '@/types';
import { EmitterSelectionModal } from './emitter-selection-modal';
import { numberToWords } from '@/lib/number-to-words';

export interface OpenReceiptModalOptions {
  receipt?: Recibo | null;
  mode?: 'create' | 'edit' | 'view';
}

interface ReceiptFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: OpenReceiptModalOptions | null;
  userId: string;
  company: Company;
  partners: Partner[];
  employees: Employee[];
}

const receiptSchema = z.object({
  numero: z.string().min(1, "O número do recibo é obrigatório."),
  valor: z.string().min(1, "O valor é obrigatório.").transform(v => String(v).replace(',', '.')).pipe(z.coerce.number().min(0.01, "O valor deve ser maior que zero.")),
  pagadorNome: z.string().min(1, "O nome do pagador é obrigatório."),
  pagadorEndereco: z.string().optional(),
  importanciaExtenso: z.string().optional(),
  referente: z.string().min(1, "O campo 'Referente a' é obrigatório."),
  data: z.date({ required_error: "A data é obrigatória." }),
  emitenteId: z.string().min(1, "Selecione um emitente."),
  emitenteNome: z.string(),
  emitenteCpfCnpj: z.string(),
  emitenteEndereco: z.string().optional(),
});

type FormData = z.infer<typeof receiptSchema>;

const defaultValues: Partial<FormData> = {
    numero: '001',
    valor: "0",
    data: new Date(),
    pagadorNome: '',
    pagadorEndereco: '',
    importanciaExtenso: '',
    referente: '',
    emitenteId: '',
    emitenteNome: '',
    emitenteCpfCnpj: '',
    emitenteEndereco: '',
};

const MemoizedEmitterSelectionModal = React.memo(EmitterSelectionModal);

export function ReceiptFormModal({ isOpen, onClose, initialData, userId, company, partners, employees }: ReceiptFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [isEmitterModalOpen, setIsEmitterModalOpen] = useState(false);
  const [selectedEmitter, setSelectedEmitter] = useState<{ id: string; name: string; cpfCnpj: string; address: string; } | null>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(receiptSchema),
    defaultValues: defaultValues as FormData,
  });

  const { reset, watch, setValue } = form;
  const mode = initialData?.mode || 'create';
  const receipt = initialData?.receipt;

  const valor = watch('valor');

  useEffect(() => {
    if (valor) {
        setValue('importanciaExtenso', numberToWords(valor));
    }
  }, [valor, setValue]);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && receipt) {
        reset({
          ...receipt,
          valor: String(receipt.valor),
        });
        setSelectedEmitter({
          id: receipt.emitenteId,
          name: receipt.emitenteNome,
          cpfCnpj: receipt.emitenteCpfCnpj,
          address: receipt.emitenteEndereco || '',
        });
      } else {
        reset(defaultValues as FormData);
        setSelectedEmitter(null);
      }
    }
  }, [isOpen, mode, receipt, reset]);
  
  const handleSelectEmitter = (emitter: { id: string, name: string, cpfCnpj: string, address: string }) => {
    setSelectedEmitter(emitter);
    setValue('emitenteId', emitter.id, { shouldValidate: true });
    setValue('emitenteNome', emitter.name);
    setValue('emitenteCpfCnpj', emitter.cpfCnpj);
    setValue('emitenteEndereco', emitter.address);
    setIsEmitterModalOpen(false);
  };

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      const dataToSave = { ...values };

      if (mode === 'create') {
        const receiptsRef = collection(db, `users/${userId}/companies/${company.id}/recibos`);
        await addDoc(receiptsRef, { ...dataToSave, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast({ title: "Recibo Criado!", description: "O recibo foi salvo com sucesso." });
      } else if (receipt?.id) {
        const receiptRef = doc(db, `users/${userId}/companies/${company.id}/recibos`, receipt.id);
        await updateDoc(receiptRef, { ...dataToSave, updatedAt: serverTimestamp() });
        toast({ title: "Recibo Atualizado!", description: "As alterações no recibo foram salvas." });
      }
      onClose();
    } catch (error) {
      console.error("Error saving receipt:", error);
      toast({ variant: "destructive", title: "Erro ao Salvar", description: "Não foi possível salvar os dados do recibo." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? 'Novo Recibo' : 'Editar Recibo'}</DialogTitle>
            <DialogDescription>Preencha os dados abaixo para gerar um novo recibo.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="numero" render={({ field }) => ( <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="data" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data</FormLabel><FormControl><DateInput value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="valor" render={({ field }) => ( <FormItem><FormLabel>Valor (R$)</FormLabel><FormControl><Input {...field} onChange={e => {
                        const { value } = e.target;
                        e.target.value = value.replace(/[^0-9,.]/g, '').replace('.', ',');
                        field.onChange(e);
                    }} /></FormControl><FormMessage /></FormItem> )} />
              </div>

              <FormField control={form.control} name="importanciaExtenso" render={({ field }) => ( <FormItem><FormLabel>Importância por Extenso</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem> )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="pagadorNome" render={({ field }) => ( <FormItem><FormLabel>Recebi(emos) de</FormLabel><FormControl><Input {...field} placeholder="Nome do pagador" /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="pagadorEndereco" render={({ field }) => ( <FormItem><FormLabel>Endereço do Pagador (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              
               <FormField control={form.control} name="referente" render={({ field }) => ( <FormItem><FormLabel>Referente a</FormLabel><FormControl><Textarea {...field} placeholder="Descrição do serviço ou produto" /></FormControl><FormMessage /></FormItem> )} />

              <FormField control={form.control} name="emitenteId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emitente</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                        <Input readOnly value={selectedEmitter?.name || ''} placeholder="Nenhum emitente selecionado" />
                    </FormControl>
                    <Button type="button" variant="outline" onClick={() => setIsEmitterModalOpen(true)}>
                        <Search className="mr-2 h-4 w-4" /> Buscar
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
                
               <FormField control={form.control} name="emitenteEndereco" render={({ field }) => ( <FormItem><FormLabel>Endereço do Emitente</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />


              <DialogFooter className="pt-6">
                <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : <Save />}
                  Salvar Recibo
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <MemoizedEmitterSelectionModal 
        isOpen={isEmitterModalOpen}
        onClose={() => setIsEmitterModalOpen(false)}
        onSelect={handleSelectEmitter}
        partners={partners}
        employees={employees}
      />
    </>
  );
}
