
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

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
  const { toast } = useToast();
  
  const form = useForm<FormData>({
    resolver: zodResolver(reopenSchema),
    defaultValues: {
        period: '',
        password: '',
    },
  });

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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
