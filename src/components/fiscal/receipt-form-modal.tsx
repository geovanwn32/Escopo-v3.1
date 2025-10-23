
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
import { Loader2, Save, Search } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DateInput } from '@/components/ui/date-input';
import type { Company, Partner, Employee, Recibo } from '@/types';
import { numberToWords } from '@/lib/number-to-words';
import { EmitterSelectionModal } from './emitter-selection-modal';

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
  numero: z.coerce.number().min(1, "O número do recibo é obrigatório."),
  valor: z.string().min(1, "O valor é obrigatório.").transform(v => String(v).replace(',', '.')).pipe(z.coerce.number().min(0.01, "O valor deve ser maior que zero.")),
  pagadorNome: z.string().min(1, "O nome do pagador é obrigatório."),
  pagadorEndereco: z.string().optional(),
  referenteA: z.string().min(1, "O campo 'Referente a' é obrigatório."),
  data: z.date({ required_error: "A data é obrigatória." }),
  emitenteId: z.string().min(1, "Selecione um emitente."),
});

type FormData = z.infer<typeof receiptSchema>;

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
    defaultValues: { numero: 1, data: new Date() }
  });

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' || mode === 'view') {
        const { receipt } = initialData;
        if (receipt) {
          form.reset({
            ...receipt,
            valor: String(receipt.valor),
            data: (receipt.date as any).toDate ? (receipt.date as any).toDate() : receipt.date,
          });
          setSelectedEmitter({ id: receipt.emitenteId, name: receipt.emitenteNome, address: receipt.emitenteEndereco });
        }
      } else {
        form.reset({
            numero: 1, // Will be replaced by next number
            valor: '0',
            pagadorNome: '',
            pagadorEndereco: '',
            referenteA: '',
            data: new Date(),
            emitenteId: '',
        });
        setSelectedEmitter(null);
        // Fetch next receipt number
        const getNextNumber = async () => {
            const recibosRef = collection(db, `users/${userId}/companies/${company.id}/recibos`);
            const q = query(recibosRef, orderBy('numero', 'desc'), limit(1));
            const snapshot = await getDocs(q);
            const lastNumber = snapshot.empty ? 0 : snapshot.docs[0].data().numero;
            form.setValue('numero', lastNumber + 1);
        };
        getNextNumber();
      }
    }
  }, [isOpen, initialData, form, userId, company.id]);

  const valor = form.watch('valor');
  const valorPorExtenso = numberToWords(parseFloat(String(valor).replace(',', '.')) || 0);

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
            toast({ title: "Recibo Salvo!", description: `Recibo nº ${values.numero} criado com sucesso.` });
        } else if (initialData.receipt?.id) {
            const reciboRef = doc(db, `users/${userId}/companies/${company.id}/recibos`, initialData.receipt.id);
            await updateDoc(reciboRef, dataToSave);
            toast({ title: "Recibo Atualizado!", description: `Recibo nº ${values.numero} atualizado com sucesso.` });
        }

        onClose();
    } catch (error) {
        console.error("Error saving receipt:", error);
        toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível salvar o recibo." });
    } finally {
        setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{mode === 'create' ? 'Lançar Novo Recibo' : 'Editar Recibo'}</DialogTitle>
              <DialogDescription>Preencha os dados abaixo para gerar um novo recibo de pagamento.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="numero" render={({ field }) => ( <FormItem><FormLabel>Número</FormLabel><FormControl><Input type="number" {...field} readOnly={isReadOnly} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="valor" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Valor (R$)</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <FormItem>
                <FormLabel>Valor por Extenso</FormLabel>
                <Input value={valorPorExtenso} readOnly className="italic text-muted-foreground" />
              </FormItem>
              <FormField control={form.control} name="pagadorNome" render={({ field }) => ( <FormItem><FormLabel>Recebi(emos) de</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} placeholder="Nome do pagador..." /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="pagadorEndereco" render={({ field }) => ( <FormItem><FormLabel>Endereço do Pagador</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} placeholder="Endereço completo (opcional)..." /></FormControl><FormMessage /></FormItem> )} />
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
              <Button type="submit" disabled={loading || isReadOnly}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
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
