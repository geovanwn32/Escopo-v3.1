
"use client";
import * as React from "react";
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Search, PlusCircle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DateInput } from '@/components/ui/date-input';
import type { Company, Partner, Employee, Recibo } from '@/types';
import { numberToWords } from '@/lib/number-to-words';
import { EmitterSelectionModal } from './emitter-selection-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

export interface ReceiptModalOptions {
  receipt?: Recibo | null;
  mode?: 'create' | 'edit' | 'view';
}

interface ReceiptFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: ReceiptModalOptions;
  userId: string;
  company: Company;
  partners: Partner[];
  employees: Employee[];
}

const receiptSchema = z.object({
  tipo: z.enum(['Recibo', 'Comprovante']),
  natureza: z.enum(['despesa', 'receita']),
  numero: z.coerce.number().min(1, "O número é obrigatório."),
  valor: z.string().min(1, "O valor é obrigatório.").transform(v => String(v).replace(',', '.')).pipe(z.coerce.number().min(0.01, "O valor deve ser maior que zero.")),
  pagadorNome: z.string().min(1, "O nome do pagador/recebedor é obrigatório."),
  pagadorEndereco: z.string().optional(),
  referenteA: z.string().min(1, "O campo 'Referente a' é obrigatório."),
  data: z.date({ required_error: "A data é obrigatória." }),
  emitenteId: z.string().min(1, "Selecione um emitente."),
});

type FormData = z.infer<typeof receiptSchema>;

const defaultValues: Partial<FormData> = {
    tipo: 'Recibo',
    natureza: 'despesa',
    numero: 1,
    valor: '0',
    pagadorNome: '',
    pagadorEndereco: '',
    referenteA: '',
    data: new Date(),
    emitenteId: '',
};


const MemoizedEmitterSelectionModal = React.memo(EmitterSelectionModal);

export function ReceiptFormModal({ isOpen, onClose, initialData, userId, company, partners, employees }: ReceiptFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [isEmitterModalOpen, setIsEmitterModalOpen] = useState(false);
  const [selectedEmitter, setSelectedEmitter] = useState<{ id: string; name: string; address?: string } | null>(null);
  const { toast } = useToast();

  const { mode = 'create' } = initialData;
  const isReadOnly = mode === 'view';
  
  const form = useForm<FormData>({
    resolver: zodResolver(receiptSchema),
    defaultValues: defaultValues
  });
  
  const fetchNextNumber = async () => {
    const recibosRef = collection(db, `users/${userId}/companies/${company.id}/recibos`);
    const q = query(recibosRef, orderBy('numero', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    const lastNumber = snapshot.empty ? 0 : snapshot.docs[0].data().numero;
    return lastNumber + 1;
  }

  const resetFormForNew = async () => {
      const nextNumber = await fetchNextNumber();
      form.reset({
          ...(defaultValues as FormData),
          numero: nextNumber
      });
      setSelectedEmitter(null);
  }

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' || mode === 'view') {
        const { receipt } = initialData;
        if (receipt) {
          form.reset({
            ...receipt,
            valor: String(receipt.valor),
            data: (receipt.data as any).toDate ? (receipt.data as any).toDate() : receipt.data,
          });
          setSelectedEmitter({ id: receipt.emitenteId, name: receipt.emitenteNome, address: receipt.emitenteEndereco });
        }
      } else {
        resetFormForNew();
      }
    }
  }, [isOpen, initialData, form, userId, company.id]);

  const valor = form.watch('valor');
  const valorPorExtenso = numberToWords(parseFloat(String(valor).replace(',', '.')) || 0);
  const natureza = form.watch('natureza');
  const tipo = form.watch('tipo');

  const handleSelectEmitter = (emitter: { id: string; name: string; address?: string; }) => {
    setSelectedEmitter(emitter);
    form.setValue('emitenteId', emitter.id);
    form.clearErrors('emitenteId');
    setIsEmitterModalOpen(false);
  };

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
        const dataToSave: Omit<Recibo, 'id'> = {
            ...values,
            emitenteNome: selectedEmitter!.name,
            emitenteEndereco: selectedEmitter!.address,
            valorPorExtenso,
            updatedAt: serverTimestamp(),
        };

        if(mode === 'create') {
            dataToSave.createdAt = serverTimestamp();
            const recibosRef = collection(db, `users/${userId}/companies/${company.id}/recibos`);
            await addDoc(recibosRef, dataToSave);
            toast({ title: "Lançamento Salvo!", description: `${values.tipo} nº ${values.numero} criado com sucesso.` });
        } else if (initialData.receipt?.id) {
            const reciboRef = doc(db, `users/${userId}/companies/${company.id}/recibos`, initialData.receipt.id);
            await updateDoc(reciboRef, dataToSave as any);
            toast({ title: "Lançamento Atualizado!", description: `${values.tipo} nº ${values.numero} atualizado com sucesso.` });
        }

        return true; // Indicate success
    } catch (error) {
        console.error("Error saving receipt:", error);
        toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível salvar o lançamento." });
        return false; // Indicate failure
    } finally {
        setLoading(false);
    }
  };

  const handleSaveAndClose = async (values: FormData) => {
    const success = await onSubmit(values);
    if(success) onClose();
  }

  const handleSaveAndNew = async (values: FormData) => {
    const success = await onSubmit(values);
    if(success) resetFormForNew();
  }


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <Form {...form}>
          <form>
            <DialogHeader>
              <DialogTitle>{mode === 'create' ? 'Lançamentos Diversos' : 'Editar Lançamento'}</DialogTitle>
              <DialogDescription>Preencha os dados abaixo para gerar um novo documento.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="tipo" render={({ field }) => ( <FormItem><FormLabel>Tipo de Documento</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Recibo">Recibo</SelectItem><SelectItem value="Comprovante">Comprovante</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="natureza" render={({ field }) => ( <FormItem><FormLabel>Natureza</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="despesa">Despesa (Saída)</SelectItem><SelectItem value="receita">Receita (Entrada)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="numero" render={({ field }) => ( <FormItem><FormLabel>Número</FormLabel><FormControl><Input type="number" {...field} readOnly={isReadOnly} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="valor" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Valor (R$)</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <FormItem>
                <FormLabel>Importância (Valor por Extenso)</FormLabel>
                <Input value={valorPorExtenso} readOnly className="italic text-muted-foreground" />
              </FormItem>
              <FormField control={form.control} name="pagadorNome" render={({ field }) => ( <FormItem><FormLabel>{natureza === 'despesa' ? (tipo === 'Recibo' ? 'Recebi(emos) de' : 'Pagador') : (tipo === 'Recibo' ? 'Pagamos a' : 'Recebedor')}</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} placeholder={natureza === 'despesa' ? 'Nome do pagador...' : 'Nome do recebedor...'} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="pagadorEndereco" render={({ field }) => ( <FormItem><FormLabel>Endereço do Pagador/Recebedor</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} placeholder="Endereço completo (opcional)..." /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="referenteA" render={({ field }) => ( <FormItem><FormLabel>Referente a</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} placeholder="Referente ao pagamento de..." /></FormControl><FormMessage /></FormItem> )} />
              <div className="grid grid-cols-2 gap-4">
                 <FormField control={form.control} name="data" render={({ field }) => ( <FormItem className="flex flex-col pt-2"><FormLabel>Data</FormLabel><FormControl><DateInput {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem> )} />
                 <FormField control={form.control} name="emitenteId" render={({ field }) => ( <FormItem><FormLabel>Emitente</FormLabel>
                    <div className="flex gap-2">
                        <FormControl>
                            <Input 
                                readOnly
                                value={selectedEmitter?.name || ''}
                                placeholder="Selecione um emitente..."
                            />
                        </FormControl>
                        <Button type="button" variant="outline" onClick={() => setIsEmitterModalOpen(true)} disabled={isReadOnly}>
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                 <FormMessage /></FormItem> )} />
              </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                {mode === 'create' && (
                    <Button type="button" onClick={form.handleSubmit(handleSaveAndNew)} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Salvar e Novo
                    </Button>
                )}
                <Button type="button" onClick={form.handleSubmit(handleSaveAndClose)} disabled={loading || isReadOnly}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {mode === 'create' ? 'Salvar e Fechar' : 'Salvar Alterações'}
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

    