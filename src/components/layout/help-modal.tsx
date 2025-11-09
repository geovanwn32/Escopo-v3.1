
"use client";

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { LifeBuoy, Mail, ExternalLink, Send, Loader2, Bot, User, Ticket, Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '../ui/form';
import type { Company } from '@/types/company';
import { askSupportAssistant } from '@/ai/flows/support-assistant-flow';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { createSupportTicket } from '@/services/ticket-service';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCompany: Company | null;
}

const ticketSchema = z.object({
  problemLocation: z.string().min(1, 'A localização do problema é obrigatória.'),
  description: z.string().min(10, 'Descreva o problema com pelo menos 10 caracteres.'),
});

const aiQuestionSchema = z.object({
    question: z.string().min(3, 'Sua pergunta deve ter pelo menos 3 caracteres.'),
})

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M16.75 13.96c.25.13.41.2.46.3.06.1.04.62-.23 1.24-.16.38-.39.71-.67.99-.48.48-1.03.87-1.6.87-.43 0-.91-.14-1.84-.59-.93-.45-1.73-.99-2.4-1.59-.83-.72-1.55-1.6-2.16-2.61-.53-.88-.85-1.78-.85-2.66 0-.78.35-1.36.93-1.92.24-.24.52-.43.8-.57.28-.14.52-.21.72-.21.21 0 .4-.03.53.03s.25.15.35.29c.1.14.15.3.15.48 0 .15-.02.3-.05.43s-.1.29-.18.43a1.9 1.9 0 0 1-.36.52c-.13.16-.25.3-.35.43s-.18.23-.26.33c-.08.1-.15.18-.21.25-.07.07-.12.13-.15.17s-.05.07-.05.07c0 .02.01.05.04.1.03.05.1.13.2.24.1.1.22.23.36.38s.28.29.45.43.34.27.52.39c.18.12.35.22.52.3.17.09.3.15.4.19.08.03.15.05.21.05.06,0 .1,0 .14-.02.13-.04.28-.15.45-.33.15-.17.27-.3.36-.42s.18-.23.24-.33c.06-.1.1-.18.14-.25.03-.07.05-.12.05-.15s0-.05-.01-.07-.02-.05-.03-.07c-.01-.02-.03-.05-.05-.08a.33.33 0 0 0-.08-.1c-.04-.04-.1-.1-.18-.18s-.15-.15-.22-.21-.14-.12-.2-.17c-.06-.05-.1-.08-.14-.1-.04-.02-.07-.03-.1-.03-.03 0-.06.01-.08.02s-.05.04-.08.06c-.03.02-.06.05-.1.08s-.08.06-.11.08c-.04.03-.07.05-.1.07l-.1.07c-.01 0-.01.01-.02.01s-.01.01-.01.02a.2.2 0 0 0 0 .09c.01.03.02.06.04.08.02.02.05.05.08.08s.07.05.1.07c.03.02.07.04.1.06s.07.04.1.05c.03.01.07.02.1.03l.1.03c.01 0 .02.01.03.01s.02.01.03.01h.02c.01 0 .02 0 .03-.01s.02-.01.03-.02l.09-.06c.03-.02.06-.04.08-.06s.05-.05.07-.07.03-.04.05-.06.03-.04.04-.06.02-.04.03-.06.02-.05.02-.07.01-.04.01-.06c0-.02,0-.04-.01-.06s-.01-.04-.02-.06a1.1 1.1 0 0 0-.12-.17c-.04-.05-.1-.1-.15-.15-.05-.05-.1-.09-.15-.14a.93.93 0 0 0-.14-.14c-.05-.04-.1-.08-.14-.11s-.09-.06-.14-.08a1.65 1.65 0 0 0-1.1-.42c-.22,0-.43.04-.63.13s-.38.21-.54.36a2.2 2.2 0 0 0-.4.49c-.1.2-.18.4-.25.61s-.12.42-.15.63c-.03.21-.05.42-.05.63 0 .43.07.88.2 1.34s.35.9.64 1.32c.29.42.66.83 1.1 1.22s.98.78 1.6 1.15c.6.37 1.25.69 1.93.96.68.27 1.35.4 2 .4.43 0 .84-.07 1.22-.22s.72-.36 1.02-.63c.3-.27.55-.58.74-.94.19-.36.33-.75.41-1.16.08-.41.12-.82.12-1.24 0-.61-.12-1.16-.35-1.66s-.5-.94-.8-1.3z" />
    </svg>
);

const SupportChannelCard = ({ icon, title, description, buttonText, onClick, disabled = false }: { icon: React.ReactNode, title: string, description: string, buttonText: string, onClick: () => void, disabled?: boolean }) => (
    <Card className="flex flex-col">
        <CardHeader>
            <div className="flex items-center gap-4">
                <div className="p-3 bg-muted rounded-full">{icon}</div>
                <CardTitle className="text-lg">{title}</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
        <CardFooter>
            <Button onClick={onClick} className="w-full" disabled={disabled}>{buttonText}</Button>
        </CardFooter>
    </Card>
)

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export function HelpModal({ isOpen, onClose, activeCompany }: HelpModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<'main' | 'ticket' | 'ai'>('main');

  // Ticket state
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  
  // AI Chat state
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const ticketForm = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { problemLocation: '', description: '' },
  });
  
  const aiForm = useForm<z.infer<typeof aiQuestionSchema>>({
      resolver: zodResolver(aiQuestionSchema),
      defaultValues: { question: '' },
  })
  
  useEffect(() => {
    // Reset views and state when modal is reopened
    if (isOpen) {
        setCurrentView('main');
        setChatHistory([]);
        ticketForm.reset();
        aiForm.reset();
    }
  }, [isOpen, ticketForm, aiForm]);

  useEffect(() => {
      // Scroll to bottom of chat history when new messages are added
      if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
      }
  }, [chatHistory]);

  const onTicketSubmit = async (values: z.infer<typeof ticketSchema>) => {
    if (!user || !activeCompany) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Usuário ou empresa não autenticados.'});
        return;
    }

    setIsSubmittingTicket(true);
    try {
        const ticketNumber = await createSupportTicket({
            requesterName: user.email!,
            requesterUid: user.uid,
            requesterCompanyId: activeCompany.id,
            requesterCompanyName: activeCompany.nomeFantasia,
            ...values,
        });
        toast({
            title: `Chamado #${ticketNumber} Aberto!`,
            description: 'Nossa equipe de suporte entrará em contato em breve.'
        });
        ticketForm.reset();
        setCurrentView('main');
    } catch(error) {
         console.error("Error creating ticket:", error);
         toast({ variant: 'destructive', title: 'Erro ao Abrir Chamado', description: 'Não foi possível registrar sua solicitação. Tente novamente.'});
    } finally {
        setIsSubmittingTicket(false);
    }
  };

  const onAiSubmit = async (values: z.infer<typeof aiQuestionSchema>) => {
      setIsAskingAI(true);
      setChatHistory(prev => [...prev, { role: 'user', content: values.question }]);
      aiForm.reset();

      try {
          const result = await askSupportAssistant({ question: values.question });
          setChatHistory(prev => [...prev, { role: 'assistant', content: result.answer }]);
      } catch (error) {
          console.error("Error asking AI assistant:", error);
          setChatHistory(prev => [...prev, { role: 'assistant', content: "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente ou abra um chamado." }]);
          toast({ variant: 'destructive', title: 'Erro na IA', description: 'Não foi possível obter uma resposta do assistente.' });
      } finally {
          setIsAskingAI(false);
      }
  };


  const renderMainView = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <LifeBuoy className="h-6 w-6 text-primary" />
          Central de Ajuda e Suporte
        </DialogTitle>
        <DialogDescription>
          Precisa de ajuda? Escolha uma das opções abaixo para começar.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
         <SupportChannelCard 
            icon={<Sparkles className="h-7 w-7 text-primary"/>}
            title="Assistente Virtual (IA)"
            description="Tire dúvidas rápidas sobre o sistema com nossa inteligência artificial."
            buttonText="Perguntar à IA"
            onClick={() => setCurrentView('ai')}
        />
         <SupportChannelCard 
            icon={<Ticket className="h-7 w-7 text-primary"/>}
            title="Abrir Chamado"
            description="Encontrou um problema ou erro? Abra um chamado detalhado para nossa equipe técnica."
            buttonText="Criar Chamado"
            onClick={() => setCurrentView('ticket')}
        />
         <SupportChannelCard 
            icon={<WhatsAppIcon className="h-7 w-7 text-primary"/>}
            title="WhatsApp"
            description="Converse diretamente com um de nossos atendentes em tempo real."
            buttonText="Chamar no WhatsApp"
            onClick={() => window.open('https://wa.me/5562998554529', '_blank')}
        />
         <SupportChannelCard 
            icon={<Mail className="h-7 w-7 text-primary"/>}
            title="E-mail"
            description="Prefere nos contatar por e-mail? Envie sua dúvida ou solicitação."
            buttonText="Enviar E-mail"
            onClick={() => window.location.href = 'mailto:geovaniwn@gmail.com'}
        />
      </div>
       <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
    </>
  );

  const renderTicketView = () => (
    <>
       <DialogHeader>
            <Button variant="ghost" size="sm" onClick={() => setCurrentView('main')} className="absolute left-4 top-4 text-muted-foreground">
             &larr; Voltar
            </Button>
          <DialogTitle className="text-center flex items-center justify-center gap-2 pt-2">
                <Ticket className="h-6 w-6 text-primary" />
                Abrir Chamado de Suporte
          </DialogTitle>
          <DialogDescription className="text-center">
            Descreva o problema que você encontrou para nossa equipe analisar.
          </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <Form {...ticketForm}>
            <form onSubmit={ticketForm.handleSubmit(onTicketSubmit)} className="space-y-4">
                <FormField control={ticketForm.control} name="problemLocation" render={({ field }) => ( <FormItem><FormLabel>Módulo/Tela com Problema</FormLabel><FormControl><Input {...field} placeholder="Ex: Módulo Fiscal > Lançamentos" /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={ticketForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Descrição Detalhada do Problema</FormLabel><FormControl><Textarea {...field} placeholder="Descreva o que aconteceu, o que você esperava que acontecesse e quaisquer mensagens de erro que apareceram." rows={5} /></FormControl><FormMessage /></FormItem> )} />
                <DialogFooter className="pt-4">
                    <Button type="submit" className="w-full" disabled={isSubmittingTicket}>
                        {isSubmittingTicket && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enviar Chamado para Suporte
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </div>
    </>
  );

  const renderAiView = () => (
     <>
        <DialogHeader>
            <Button variant="ghost" size="sm" onClick={() => setCurrentView('main')} className="absolute left-4 top-4 text-muted-foreground">
             &larr; Voltar
            </Button>
            <DialogTitle className="text-center flex items-center justify-center gap-2 pt-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Assistente Virtual
            </DialogTitle>
            <DialogDescription className="text-center">
                Pergunte sobre as funcionalidades do sistema. Ex: "Como faço para calcular as férias?"
            </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col h-[60vh]">
            <ScrollArea className="flex-1 p-4 border rounded-md" ref={scrollAreaRef}>
                 <div className="space-y-4">
                    {chatHistory.map((message, index) => (
                        <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                            {message.role === 'assistant' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="h-5 w-5 text-primary" /></div>}
                             <div className={`p-3 rounded-lg max-w-sm ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                                    {message.content}
                                </ReactMarkdown>
                             </div>
                             {message.role === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center"><User className="h-5 w-5 text-muted-foreground" /></div>}
                        </div>
                    ))}
                    {isAskingAI && (
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="h-5 w-5 text-primary" /></div>
                            <div className="p-3 rounded-lg bg-muted"><Loader2 className="h-5 w-5 animate-spin"/></div>
                        </div>
                    )}
                 </div>
            </ScrollArea>
             <Form {...aiForm}>
                <form onSubmit={aiForm.handleSubmit(onAiSubmit)} className="flex items-center gap-2 pt-4">
                    <FormField control={aiForm.control} name="question" render={({ field }) => ( <FormItem className="flex-1"><FormControl><Input {...field} placeholder="Digite sua pergunta aqui..." disabled={isAskingAI} /></FormControl><FormMessage /></FormItem> )} />
                    <Button type="submit" disabled={isAskingAI}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </Form>
        </div>
        <DialogFooter className="pt-4 justify-start">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4"/> A resposta da IA não ajudou?
                <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setCurrentView('ticket')}>Abra um chamado</Button>
            </p>
        </DialogFooter>
     </>
  );


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        {currentView === 'main' && renderMainView()}
        {currentView === 'ticket' && renderTicketView()}
        {currentView === 'ai' && renderAiView()}
      </DialogContent>
    </Dialog>
  );
}
