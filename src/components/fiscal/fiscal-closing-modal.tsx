
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

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
  const { toast } = useToast();
  
  const form = useForm<FormData>({
    resolver: zodResolver(closingSchema),
    defaultValues: {
        period: '',
    },
  });

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

