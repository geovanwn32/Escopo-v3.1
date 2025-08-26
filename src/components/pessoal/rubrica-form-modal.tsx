
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Rubrica } from '@/types/rubrica';

interface RubricaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  rubrica: Rubrica | null;
}

const rubricaSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório").max(4, "Código pode ter no máximo 4 caracteres."),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  tipo: z.enum(['provento', 'desconto'], { required_error: "Tipo é obrigatório." }),
  naturezaESocial: z.string().min(4, "Natureza deve ter 4 dígitos.").max(4, "Natureza deve ter 4 dígitos."),
  incideINSS: z.boolean().default(false),
  incideFGTS: z.boolean().default(false),
  incideIRRF: z.boolean().default(false),
});

const defaultRubricaValues: z.infer<typeof rubricaSchema> = {
    codigo: '',
    descricao: '',
    tipo: 'provento',
    naturezaESocial: '',
    incideINSS: false,
    incideFGTS: false,
    incideIRRF: false,
};

export function RubricaFormModal({ isOpen, onClose, userId, companyId, rubrica }: RubricaFormModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const modalKey = rubrica?.id || 'new-rubrica';
  const form = useForm<z.infer<typeof rubricaSchema>>({
    resolver: zodResolver(rubricaSchema),
  });

  const mode = rubrica ? 'edit' : 'create';

  useEffect(() => {
    if (isOpen) {
        if (rubrica) {
            form.reset({
                ...defaultRubricaValues,
                ...rubrica,
            });
        } else {
            form.reset(defaultRubricaValues);
        }
    }
  }, [isOpen, rubrica, form]);


  const onSubmit = async (values: z.infer<typeof rubricaSchema>) => {
    setLoading(true);
    try {
      if (mode === 'create') {
        const rubricasRef = collection(db, `users/${userId}/companies/${companyId}/rubricas`);
        await addDoc(rubricasRef, values);
        toast({
          title: "Rubrica Cadastrada!",
          description: `A rubrica ${values.descricao} foi adicionada com sucesso.`,
        });
      } else if (rubrica?.id) {
        const rubricaRef = doc(db, `users/${userId}/companies/${companyId}/rubricas`, rubrica.id);
        await setDoc(rubricaRef, values);
        toast({
          title: "Rubrica Atualizada!",
          description: `Os dados da rubrica foram atualizados.`,
        });
      }
      
      onClose();
    } catch (error) {
        console.error("Error saving rubrica:", error);
        toast({
            variant: "destructive",
            title: "Erro ao salvar",
            description: "Não foi possível salvar os dados da rubrica."
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl" key={modalKey}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Cadastro de Nova Rubrica' : 'Alterar Rubrica'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? "Preencha os dados abaixo para cadastrar uma nova rubrica."
              : `Alterando os dados da rubrica ${rubrica?.codigo} - ${rubrica?.descricao}.`
            }
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="codigo" render={({ field }) => ( <FormItem><FormLabel>Código</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="descricao" render={({ field }) => ( <FormItem><FormLabel>Descrição da Rubrica</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="tipo" render={({ field }) => ( <FormItem><FormLabel>Tipo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="provento">Provento</SelectItem><SelectItem value="desconto">Desconto</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="naturezaESocial" render={({ field }) => ( <FormItem><FormLabel>Natureza eSocial</FormLabel><FormControl><Input {...field} maxLength={4} /></FormControl><FormMessage /></FormItem> )} />
            </div>
            
            <div>
                <FormLabel>Incidências</FormLabel>
                <FormDescription>Marque as bases de cálculo em que esta rubrica deve incidir.</FormDescription>
                <div className="space-y-2 mt-2">
                    <FormField
                        control={form.control}
                        name="incideINSS"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Incidência INSS</FormLabel>
                                    <FormDescription>Incide para o cálculo da contribuição previdenciária.</FormDescription>
                                </div>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="incideFGTS"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Incidência FGTS</FormLabel>
                                    <FormDescription>Incide para o cálculo do Fundo de Garantia.</FormDescription>
                                </div>
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="incideIRRF"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Incidência IRRF</FormLabel>
                                    <FormDescription>Incide para o cálculo do Imposto de Renda Retido na Fonte.</FormDescription>
                                </div>
                            </FormItem>
                        )}
                    />
                </div>
            </div>

            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Save />}
                {mode === 'create' ? 'Salvar Rubrica' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
