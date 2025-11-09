"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { Company } from '@/types/company';
import { generateAnnualReportPdf } from '@/services/annual-report-service';

interface AnnualReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  company: Company;
}

const formSchema = z.object({
  year: z.coerce.number().min(2000, "Ano inválido.").max(new Date().getFullYear() + 1, "Ano inválido."),
});

type FormData = z.infer<typeof formSchema>;

export function AnnualReportModal({ isOpen, onClose, userId, company }: AnnualReportModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      year: new Date().getFullYear(),
    },
  });

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      await generateAnnualReportPdf(userId, company, values.year);
      toast({ title: "Relatório Gerado!", description: "Seu relatório anual está sendo aberto em uma nova aba." });
      onClose();
    } catch (error) {
        console.error("Error generating annual report:", error);
        toast({ variant: "destructive", title: "Erro ao Gerar Relatório", description: (error as Error).message });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Relatório Fiscal Anual</DialogTitle>
          <DialogDescription>
            Informe o ano para o qual deseja gerar o relatório consolidado de entradas e saídas.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ano de Referência</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Gerar Relatório
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
