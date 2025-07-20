
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Employee } from '@/types/employee';
import { Company } from '@/types/company';
import { generateAdmissionEvent } from '@/services/esocial-admission-service';

interface AdmissionFormProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  company: Company;
  employee: Employee;
}

const admissionSchema = z.object({
  cbo: z.string().length(6, "CBO deve ter 6 dígitos"),
  naturezaAtividade: z.enum(['1', '2'], { required_error: "Natureza da atividade é obrigatória." }),
  tipoRegimeTrabalhista: z.enum(['1', '2'], { required_error: "Regime trabalhista é obrigatório." }),
  tipoRegimePrevidenciario: z.enum(['1', '2', '3'], { required_error: "Regime previdenciário é obrigatório." }),
  categoriaTrabalhador: z.string().min(1, "Categoria do trabalhador é obrigatória"),
});

export function AdmissionForm({ isOpen, onClose, userId, company, employee }: AdmissionFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof admissionSchema>>({
    resolver: zodResolver(admissionSchema),
    defaultValues: {
        naturezaAtividade: '1',
        tipoRegimeTrabalhista: '1',
        tipoRegimePrevidenciario: '1',
    },
  });

  const onSubmit = async (values: z.infer<typeof admissionSchema>) => {
    setLoading(true);
    try {
        await generateAdmissionEvent(userId, company, employee, values);
        toast({
          title: "Evento S-2200 Gerado!",
          description: `O evento de admissão para ${employee.nomeCompleto} foi criado e está pendente de envio.`,
        });
        onClose();
    } catch (error) {
        console.error("Error generating S-2200:", error);
        toast({
            variant: "destructive",
            title: "Erro ao Gerar Evento",
            description: (error as Error).message
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar Admissão (S-2200)</DialogTitle>
          <DialogDescription>
            Preencha os dados complementares para a admissão de <span className="font-semibold">{employee.nomeCompleto}</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                <FormField control={form.control} name="categoriaTrabalhador" render={({ field }) => ( <FormItem><FormLabel>Categoria do Trabalhador</FormLabel><FormControl><Input {...field} placeholder="Ex: 101" /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="cbo" render={({ field }) => ( <FormItem><FormLabel>CBO (Classificação Brasileira de Ocupações)</FormLabel><FormControl><Input {...field} placeholder="Ex: 411010" /></FormControl><FormMessage /></FormItem> )} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="naturezaAtividade" render={({ field }) => ( <FormItem><FormLabel>Natureza da Atividade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="1">Trabalho Urbano</SelectItem><SelectItem value="2">Trabalho Rural</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="tipoRegimeTrabalhista" render={({ field }) => ( <FormItem><FormLabel>Regime Trabalhista</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="1">CLT</SelectItem><SelectItem value="2">Estatutário</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                 <FormField control={form.control} name="tipoRegimePrevidenciario" render={({ field }) => ( <FormItem><FormLabel>Regime Previdenciário</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="1">RGPS</SelectItem><SelectItem value="2">RPPS</SelectItem><SelectItem value="3">RPPS no exterior</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />

                <DialogFooter className="pt-6">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin mr-2"/> : <Send className="mr-2" />}
                        Gerar Evento
                    </Button>
                </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
