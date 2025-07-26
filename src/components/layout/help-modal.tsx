
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

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M16.75 13.96c.25.13.41.2.46.3.06.1.04.62-.23 1.24-.16.38-.39.71-.67.99-.48.48-1.03.87-1.6.87-.43 0-.91-.14-1.84-.59-.93-.45-1.73-.99-2.4-1.59-.83-.72-1.55-1.6-2.16-2.61-.53-.88-.85-1.78-.85-2.66 0-.78.35-1.36.93-1.92.24-.24.52-.43.8-.57.28-.14.52-.21.72-.21.21 0 .4-.03.53.03s.25.15.35.29c.1.14.15.3.15.48 0 .15-.02.3-.05.43s-.1.29-.18.43a1.9 1.9 0 0 1-.36.52c-.13.16-.25.3-.35.43s-.18.23-.26.33c-.08.1-.15.18-.21.25-.07.07-.12.13-.15.17s-.05.07-.05.07c0 .02.01.05.04.1.03.05.1.13.2.24.1.1.22.23.36.38s.28.29.45.43.34.27.52.39c.18.12.35.22.52.3.17.09.3.15.4.19.08.03.15.05.21.05.06,0 .1,0 .14-.02.13-.04.28-.15.45-.33.15-.17.27-.3.36-.42s.18-.23.24-.33c.06-.1.1-.18.14-.25.03-.07.05-.12.05-.15s0-.05-.01-.07-.02-.05-.03-.07c-.01-.02-.03-.05-.05-.08a.33.33 0 0 0-.08-.1c-.04-.04-.1-.1-.18-.18s-.15-.15-.22-.21-.14-.12-.2-.17c-.06-.05-.1-.08-.14-.1-.04-.02-.07-.03-.1-.03-.03 0-.06.01-.08.02s-.05.04-.08.06c-.03.02-.06.05-.1.08s-.08.06-.11.08c-.04.03-.07.05-.1.07l-.1.07c-.01 0-.01.01-.02.01s-.01.01-.01.02a.2.2 0 0 0 0 .09c.01.03.02.06.04.08.02.02.05.05.08.08s.07.05.1.07c.03.02.07.04.1.06s.07.04.1.05c.03.01.07.02.1.03l.1.03c.01 0 .02.01.03.01s.02.01.03.01h.02c.01 0 .02 0 .03-.01s.02-.01.03-.02l.09-.06c.03-.02.06-.04.08-.06s.05-.05.07-.07.03-.04.05-.06.03-.04.04-.06.02-.04.03-.06.02-.05.02-.07.01-.04.01-.06c0-.02,0-.04-.01-.06s-.01-.04-.02-.06a1.1 1.1 0 0 0-.12-.17c-.04-.05-.1-.1-.15-.15-.05-.05-.1-.09-.15-.14a.93.93 0 0 0-.14-.14c-.05-.04-.1-.08-.14-.11s-.09-.06-.14-.08a1.65 1.65 0 0 0-1.1-.42c-.22,0-.43.04-.63.13s-.38.21-.54.36a2.2 2.2 0 0 0-.4.49c-.1.2-.18.4-.25.61s-.12.42-.15.63c-.03.21-.05.42-.05.63 0 .43.07.88.2 1.34s.35.9.64 1.32c.29.42.66.83 1.1 1.22s.98.78 1.6 1.15c.6.37 1.25.69 1.93.96.68.27 1.35.4 2 .4.43 0 .84-.07 1.22-.22s.72-.36 1.02-.63c.3-.27.55-.58.74-.94.19-.36.33-.75.41-1.16.08-.41.12-.82.12-1.24 0-.61-.12-1.16-.35-1.66s-.5-.94-.8-1.3z" />
    </svg>
);


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
      <DialogContent className="sm:max-w-4xl">
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
                <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                    <h4 className="font-semibold mb-2">Contatos de Suporte</h4>
                    <p className="text-sm text-muted-foreground">
                        Para questões urgentes, entre em contato conosco diretamente.
                    </p>
                     <Button asChild className="w-full">
                        <Link href="mailto:Geovanisilvaoliveira447@gmail.com">
                            <Mail className="mr-2 h-4 w-4" />
                            Geovanisilvaoliveira447@gmail.com
                        </Link>
                    </Button>
                    <Button asChild variant="secondary" className="w-full">
                        <Link href="https://wa.me/5562998554529" target="_blank">
                            <WhatsAppIcon className="mr-2 h-4 w-4" />
                            WhatsApp: (62) 99855-4529
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
