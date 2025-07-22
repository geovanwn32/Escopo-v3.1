
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

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const messageSchema = z.object({
  name: z.string().min(1, 'Seu nome é obrigatório.'),
  email: z.string().email('Por favor, insira um email válido.'),
  subject: z.string().min(1, 'O assunto é obrigatório.'),
  message: z.string().min(10, 'A mensagem deve ter pelo menos 10 caracteres.'),
});

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof messageSchema>>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      name: '',
      email: user?.email || '',
      subject: '',
      message: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof messageSchema>) => {
    setLoading(true);
    // Simulating an API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log("Form submitted:", values);
    toast({
      title: "Mensagem Enviada!",
      description: "Sua mensagem foi enviada para nossa equipe de suporte.",
    });
    setLoading(false);
    setSubmitted(true);
    form.reset();
  };

  const handleClose = () => {
    onClose();
    // Reset submitted state after the dialog closes
    setTimeout(() => {
        setSubmitted(false);
        form.reset({
             name: '',
             email: user?.email || '',
             subject: '',
             message: '',
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
            Precisa de ajuda? Envie-nos uma mensagem ou consulte nossos links úteis.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
                <h3 className="font-semibold">Enviar uma Mensagem</h3>
                {submitted ? (
                     <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 h-full bg-muted rounded-lg">
                        <Mail className="h-12 w-12 text-green-500" />
                        <h3 className="text-xl font-bold">Mensagem Enviada!</h3>
                        <p className="text-muted-foreground">Obrigado pelo seu contato. Nossa equipe responderá em breve.</p>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                             <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Assunto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="message" render={({ field }) => (<FormItem><FormLabel>Mensagem</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <Button type="submit" disabled={loading} className="w-full">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                Enviar Mensagem
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
