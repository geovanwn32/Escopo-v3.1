
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
import { LifeBuoy, Mail, ExternalLink, Send, Loader2, Ticket as TicketIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { createSupportTicket } from '@/services/ticket-service';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCompany: { id: string; nomeFantasia: string } | null;
}

const ticketSchema = z.object({
  requesterName: z.string().min(1, 'Seu nome completo é obrigatório.'),
  problemLocation: z.string().min(1, 'É necessário informar onde o problema ocorre.'),
  description: z.string().min(10, 'Por favor, detalhe o problema com pelo menos 10 caracteres.'),
});

export function HelpModal({ isOpen, onClose, activeCompany }: HelpModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);

  const form = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      requesterName: '',
      problemLocation: '',
      description: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof ticketSchema>) => {
    if (!user || !activeCompany) {
      toast({
        variant: 'destructive',
        title: 'Erro de Autenticação',
        description: 'Não foi possível identificar o usuário ou a empresa.',
      });
      return;
    }
    setLoading(true);
    try {
      const ticketData = {
        ...values,
        requesterUid: user.uid,
        requesterCompanyId: activeCompany.id,
        requesterCompanyName: activeCompany.nomeFantasia,
      };
      const ticketNumber = await createSupportTicket(ticketData);
      setSubmittedTicket(ticketNumber);
      form.reset();
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro ao Abrir Chamado',
        description: 'Não foi possível registrar seu chamado. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
        setSubmittedTicket(null);
    }, 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Central de Ajuda
          </DialogTitle>
          <DialogDescription>
            Precisa de ajuda? Aqui estão algumas opções de suporte.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="ticket" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ticket">Abrir Chamado</TabsTrigger>
                <TabsTrigger value="links">Links Úteis</TabsTrigger>
            </TabsList>
            <TabsContent value="ticket">
                {submittedTicket ? (
                     <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                        <TicketIcon className="h-12 w-12 text-green-500" />
                        <h3 className="text-xl font-bold">Chamado Enviado!</h3>
                        <p className="text-muted-foreground">Seu ticket de suporte foi aberto com o número:</p>
                        <p className="text-2xl font-mono p-2 bg-muted rounded-md">{submittedTicket}</p>
                        <p className="text-xs text-muted-foreground pt-4">Nossa equipe entrará em contato em breve. Você já pode fechar esta janela.</p>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="requesterName" render={({ field }) => (<FormItem><FormLabel>Seu Nome Completo</FormLabel><FormControl><Input placeholder="Nome e Sobrenome" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="problemLocation" render={({ field }) => (<FormItem><FormLabel>Onde o problema ocorre?</FormLabel><FormControl><Input placeholder="Ex: Tela de Funcionários, botão Salvar" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descreva o problema</FormLabel><FormControl><Textarea placeholder="Detalhe o que aconteceu, a mensagem de erro (se houver) e o que você esperava que acontecesse." {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="flex justify-end">
                                <Button type="submit" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                    Enviar Chamado
                                </Button>
                            </div>
                        </form>
                    </Form>
                )}
            </TabsContent>
            <TabsContent value="links">
                 <div className="py-4 space-y-4">
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
                            Para questões urgentes ou problemas técnicos, entre em contato conosco diretamente por email.
                        </p>
                        <Button asChild>
                            <Link href="mailto:suporte@escopo.com.br">
                                <Mail className="mr-2 h-4 w-4" />
                                suporte@escopo.com.br
                            </Link>
                        </Button>
                    </div>
                </div>
            </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
