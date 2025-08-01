
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, ListChecks } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';

interface FiscalClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
}

const closingSchema = z.object({
  period: z.string().regex(/^(0[1-9]|1[0-2])\/\d{4}$/, "Formato inválido. Use MM/AAAA."),
});

type FormData = z.infer<typeof closingSchema>;

export function FiscalClosingModal({ isOpen, onClose, userId, companyId }: FiscalClosingModalProps) {
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [closedPeriods, setClosedPeriods] = useState<string[]>([]);
  const { toast } = useToast();
  
  const form = useForm<FormData>({
    resolver: zodResolver(closingSchema),
    defaultValues: {
        period: '',
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    const fetchClosedPeriods = async () => {
        setListLoading(true);
        try {
            const closuresRef = collection(db, `users/${userId}/companies/${companyId}/fiscalClosures`);
            const q = query(closuresRef, orderBy('closedAt', 'desc'));
            const snapshot = await getDocs(q);
            const periods = snapshot.docs.map(doc => doc.id.split('-').reverse().join('/'));
            setClosedPeriods(periods);
        } catch (error) {
            console.error("Erro ao buscar períodos fechados:", error);
            toast({ variant: 'destructive', title: 'Erro ao listar períodos.' });
        } finally {
            setListLoading(false);
        }
    };
    
    fetchClosedPeriods();
  }, [isOpen, userId, companyId, toast]);


  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
        const periodId = values.period.split('/').reverse().join('-'); // Convert MM/YYYY to YYYY-MM
        const closingRef = doc(db, `users/${userId}/companies/${companyId}/fiscalClosures`, periodId);

        const docSnap = await getDoc(closingRef);
        if (docSnap.exists()) {
            toast({ variant: "destructive", title: "Período já fechado", description: "Este período fiscal já se encontra fechado." });
            setLoading(false);
            return;
        }

        await setDoc(closingRef, {
            closedAt: serverTimestamp(),
            closedBy: userId,
        });

      toast({ title: "Período Fiscal Fechado!", description: `O período ${values.period} foi fechado com sucesso. Lançamentos não podem mais ser alterados.` });
      onClose();
    } catch (error) {
        console.error("Error closing period:", error);
        toast({ variant: "destructive", title: "Erro ao fechar período", description: "Não foi possível realizar o fechamento." });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fechamento Fiscal</DialogTitle>
          <DialogDescription>
            Insira o período (mês/ano) que deseja fechar. Após o fechamento, os lançamentos deste período não poderão ser alterados ou excluídos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2"><ListChecks className="h-4 w-4" /> Períodos Já Fechados</h4>
             <div className="border rounded-md p-3 text-sm h-28 overflow-y-auto">
                {listLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
                ) : closedPeriods.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {closedPeriods.map(p => (
                            <Badge 
                                key={p} 
                                variant="secondary" 
                                className="font-mono cursor-pointer hover:bg-muted"
                                onClick={() => form.setValue('period', p)}
                            >
                                {p}
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">Nenhum período fechado.</div>
                )}
            </div>
        </div>

        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Período (MM/AAAA)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: 07/2024" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Lock />}
                Fechar Período
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
