
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { LifeBuoy, Mail, ExternalLink, Send, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import type { Company } from '@/types/company';
import { createSupportTicket } from '@/services/ticket-service';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCompany: Company | null;
}

const messageSchema = z.object({
  problemLocation: z.string().min(1, 'O local do problema é obrigatório.'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
});

export function HelpModal({ isOpen, onClose, activeCompany }: HelpModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof messageSchema>>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      problemLocation: '',
      description: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof messageSchema>) => {
    if (!user || !activeCompany) {
      toast({ variant: 'destructive', title: "Erro", description: "Usuário ou empresa não identificada." });
      return;
    }
    setLoading(true);
    
    try {
      const ticketNumber = await createSupportTicket({
        requesterName: user.displayName || user.email || 'Usuário Anônimo',
        requesterUid: user.uid,
        requesterCompanyId: activeCompany.id,
        requesterCompanyName: activeCompany.nomeFantasia,
        problemLocation: values.problemLocation,
        description: values.description,
      });
      
      toast({
        title: "Chamado Aberto com Sucesso!",
        description: `Seu ticket de suporte nº ${ticketNumber} foi registrado.`,
      });
      setSubmitted(true);
      form.reset();
    } catch(error) {
       console.error("Error creating ticket:", error);
       toast({
        variant: "destructive",
        title: "Erro ao Abrir Chamado",
        description: "Não foi possível registrar sua solicitação. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
        setSubmitted(false);
        form.reset({
             problemLocation: '',
             description: '',
        });
    }, 300);
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Central de Ajuda e Suporte
          </DialogTitle>
          <DialogDescription>
            Precisa de ajuda? Abra um chamado de suporte detalhando o seu problema.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
                <h3 className="font-semibold">Abrir Chamado de Suporte</h3>
                {submitted ? (
                     <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 h-full bg-muted rounded-lg">
                        <Mail className="h-12 w-12 text-green-500" />
                        <h3 className="text-xl font-bold">Chamado Enviado!</h3>
                        <p className="text-muted-foreground">Obrigado pelo seu contato. Nossa equipe analisará sua solicitação em breve.</p>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                             <FormField control={form.control} name="problemLocation" render={({ field }) => (<FormItem><FormLabel>Onde ocorre o problema?</FormLabel><FormControl><Input {...field} placeholder="Ex: Módulo Fiscal > Lançamentos" /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrição do Problema</FormLabel><FormControl><Textarea rows={6} {...field} placeholder="Descreva o problema em detalhes. Se houver alguma mensagem de erro, por favor, inclua aqui." /></FormControl><FormMessage /></FormItem> )} />
                             <Button type="submit" disabled={loading || !activeCompany} className="w-full">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                Enviar Chamado
                            </Button>
                        </form>
                    </Form>
                )}
            </div>
             <div className="space-y-4">
                <h3 className="font-semibold">Recursos Úteis</h3>
                 <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-semibold mb-2">Documentação</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                        Ainda não temos uma documentação completa, mas estamos trabalhando nisso. Em breve, você encontrará guias detalhados e tutoriais aqui.
                    </p>
                    <Button variant="outline" disabled>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Acessar Documentação (Em Breve)
                    </Button>
                </div>
                <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-semibold mb-2">Suporte por Email</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                        Para questões urgentes, entre em contato conosco diretamente por email.
                    </p>
                    <Button asChild>
                        <Link href="mailto:suporte@escopo.com.br">
                            <Mail className="mr-2 h-4 w-4" />
                            suporte@escopo.com.br
                        </Link>
                    </Button>
                </div>
             </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
