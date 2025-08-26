
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, PlusCircle, Trash2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import type { LancamentoContabil } from '@/types/lancamento-contabil';
import type { ContaContabil } from '@/types/conta-contabil';
import { Separator } from '../ui/separator';

interface LancamentoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  lancamento: LancamentoContabil | null;
  contas: ContaContabil[];
}

const partidaSchema = z.object({
  contaId: z.string().min(1, "Selecione uma conta"),
  tipo: z.enum(['debito', 'credito']),
  valor: z.string().transform(v => String(v).replace(',', '.')).pipe(z.coerce.number().min(0.01, "Valor deve ser maior que zero")),
});

const lancamentoSchema = z.object({
  data: z.date({ required_error: "A data é obrigatória." }),
  descricao: z.string().min(1, "A descrição é obrigatória."),
  partidas: z.array(partidaSchema).min(2, "O lançamento deve ter ao menos uma partida de débito e uma de crédito."),
}).refine(data => {
    const totalDebito = data.partidas.filter(p => p.tipo === 'debito').reduce((acc, p) => acc + p.valor, 0);
    const totalCredito = data.partidas.filter(p => p.tipo === 'credito').reduce((acc, p) => acc + p.valor, 0);
    return Math.abs(totalDebito - totalCredito) < 0.001; // Compare with a tolerance
}, {
    message: "O total de débitos deve ser igual ao total de créditos.",
    path: ["partidas"],
});


type FormData = z.infer<typeof lancamentoSchema>;

export function LancamentoFormModal({ isOpen, onClose, userId, companyId, lancamento, contas }: LancamentoFormModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const modalKey = lancamento?.id || 'new-lancamento';
  
  const form = useForm<FormData>({
    resolver: zodResolver(lancamentoSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "partidas"
  });

  const partidas = useWatch({ control: form.control, name: 'partidas' });

  const totalDebito = partidas.reduce((acc, p) => p.tipo === 'debito' ? acc + Number(String(p.valor).replace(/,/, '.') || 0) : acc, 0);
  const totalCredito = partidas.reduce((acc, p) => p.tipo === 'credito' ? acc + Number(String(p.valor).replace(/,/, '.') || 0) : acc, 0);
  const difference = totalDebito - totalCredito;

  const mode = lancamento ? 'edit' : 'create';

  useEffect(() => {
    if (isOpen) {
      if (lancamento) {
          form.reset({
              ...lancamento,
              partidas: lancamento.partidas.map(p => ({ ...p, valor: String(p.valor) })) as any,
          });
      } else {
          form.reset({
              data: new Date(),
              descricao: '',
              partidas: [
                  { contaId: '', tipo: 'debito', valor: 0 },
                  { contaId: '', tipo: 'credito', valor: 0 },
              ]
          });
      }
    }
  }, [isOpen, lancamento, form]);


  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      const valorTotal = values.partidas.filter(p => p.tipo === 'debito').reduce((acc, p) => acc + p.valor, 0);
      const dataToSave = { ...values, valorTotal, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      
      if (mode === 'create') {
        const lancamentosRef = collection(db, `users/${userId}/companies/${companyId}/lancamentosContabeis`);
        await addDoc(lancamentosRef, dataToSave);
        toast({ title: "Lançamento Criado!" });
      } else if (lancamento?.id) {
        const lancamentoRef = doc(db, `users/${userId}/companies/${companyId}/lancamentosContabeis`, lancamento.id);
        delete (dataToSave as any).createdAt; // Do not overwrite creation date
        await setDoc(lancamentoRef, dataToSave, { merge: true });
        toast({ title: "Lançamento Atualizado!" });
      }
      onClose();
    } catch (error) {
        console.error("Error saving lancamento:", error);
        toast({ variant: "destructive", title: "Erro ao salvar lançamento." });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl" key={modalKey}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Novo Lançamento Contábil' : 'Editar Lançamento Contábil'}</DialogTitle>
          <DialogDescription>Insira as partidas de débito e crédito. O total de débitos deve ser igual ao total de créditos.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="data" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="descricao" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Descrição (Histórico)</FormLabel><FormControl><Input {...field} placeholder="Ex: Pagamento de fornecedor" /></FormControl><FormMessage /></FormItem> )} />
            </div>
            
            <Separator />
            <div className="max-h-[40vh] overflow-y-auto pr-2 space-y-4">
            {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                     <FormField control={form.control} name={`partidas.${index}.tipo`} render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Tipo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="debito">Débito</SelectItem><SelectItem value="credito">Crédito</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name={`partidas.${index}.contaId`} render={({ field }) => ( <FormItem className="col-span-6"><FormLabel>Conta Contábil</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione uma conta..." /></SelectTrigger></FormControl><SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id!}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name={`partidas.${index}.valor`} render={({ field }) => ( <FormItem className="col-span-3"><FormLabel>Valor (R$)</FormLabel><FormControl><Input {...field} type="text" onChange={e => {
                          const { value } = e.target;
                          e.target.value = value.replace(/[^0-9,.]/g, '').replace('.', ',');
                          field.onChange(e);
                      }} /></FormControl><FormMessage /></FormItem> )} />
                     <div className="col-span-1 flex items-end h-full">
                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} className="mt-auto">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ))}
            </div>

             <Button type="button" variant="outline" className="w-full" onClick={() => append({ contaId: '', tipo: 'debito', valor: 0 })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Partida
            </Button>
            
            <Separator />

             <div className="flex justify-end items-center gap-6 p-4 bg-muted rounded-md">
                <div><span className="text-sm text-muted-foreground">Débitos:</span> <span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDebito)}</span></div>
                <div><span className="text-sm text-muted-foreground">Créditos:</span> <span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCredito)}</span></div>
                <div><span className="text-sm text-muted-foreground">Diferença:</span> <span className={`font-bold ${difference !== 0 ? 'text-destructive' : 'text-green-600'}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(difference)}</span></div>
            </div>
            {form.formState.errors.partidas && <p className="text-sm font-medium text-destructive text-center">{form.formState.errors.partidas.message}</p>}


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
