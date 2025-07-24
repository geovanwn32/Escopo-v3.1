
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, deleteDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, ListChecks } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';

interface ReopenPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
}

const reopenSchema = z.object({
  period: z.string().regex(/^(0[1-9]|1[0-2])\/\d{4}$/, "Formato inválido. Use MM/AAAA."),
  password: z.string().min(1, "A senha é obrigatória."),
});

type FormData = z.infer<typeof reopenSchema>;
const REOPEN_PASSWORD = "3830";

export function ReopenPeriodModal({ isOpen, onClose, userId, companyId }: ReopenPeriodModalProps) {
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [closedPeriods, setClosedPeriods] = useState<string[]>([]);
  const { toast } = useToast();
  
  const form = useForm<FormData>({
    resolver: zodResolver(reopenSchema),
    defaultValues: {
        period: '',
        password: '',
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
    if (values.password !== REOPEN_PASSWORD) {
        toast({ variant: "destructive", title: "Senha Incorreta", description: "A senha para reabrir o período está incorreta." });
        return;
    }
    
    setLoading(true);
    try {
        const periodId = values.period.split('/').reverse().join('-'); // Convert MM/YYYY to YYYY-MM
        const closingRef = doc(db, `users/${userId}/companies/${companyId}/fiscalClosures`, periodId);

        await deleteDoc(closingRef);

        toast({ title: "Período Fiscal Reaberto!", description: `O período ${values.period} foi reaberto e pode ser editado.` });
        onClose();
    } catch (error) {
        console.error("Error reopening period:", error);
        toast({ variant: "destructive", title: "Erro ao reabrir período", description: "O período pode não estar fechado ou ocorreu um erro inesperado." });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reabrir Período Fiscal</DialogTitle>
          <DialogDescription>
            Para reabrir um período e permitir alterações, informe o período e a senha de segurança. Esta ação deve ser usada com cautela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2"><ListChecks className="h-4 w-4" /> Períodos Fechados</h4>
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Período a Reabrir (MM/AAAA)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: 07/2024" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha de Segurança</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Reabrir Período
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
