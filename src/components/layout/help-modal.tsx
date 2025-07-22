
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { LifeBuoy, Mail, ExternalLink, Send, Loader2, Ticket as TicketIcon, Inbox, ListChecks } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { createSupportTicket } from '@/services/ticket-service';
import type { Ticket, TicketStatus } from '@/types/ticket';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ADMIN_UID = 'h2nff6rF7yVbICGz2mZ1aCgNqj73';

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

// Component to list tickets for a user or all for admin
function TicketList({ forAdmin }: { forAdmin: boolean }) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const ticketsRef = collection(db, 'tickets');
        let q;

        if (forAdmin && user.uid === ADMIN_UID) {
            q = query(ticketsRef, orderBy('createdAt', 'desc'));
        } else if (!forAdmin) {
            q = query(ticketsRef, where('requesterUid', '==', user.uid), orderBy('createdAt', 'desc'));
        } else {
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ticketsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate(),
            } as Ticket));
            setTickets(ticketsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching tickets for modal: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar chamados." });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, forAdmin, toast]);

    const getStatusVariant = (status: TicketStatus) => {
        switch (status) {
            case 'open': return 'destructive';
            case 'in_progress': return 'default';
            case 'closed': return 'secondary';
            default: return 'outline';
        }
    }

    const getStatusLabel = (status: TicketStatus) => {
        switch (status) {
            case 'open': return 'Aberto';
            case 'in_progress': return 'Em Progresso';
            case 'closed': return 'Fechado';
            default: return status;
        }
    }

    if (loading) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    if (tickets.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10">
                <p>Nenhum chamado encontrado.</p>
            </div>
        );
    }
    
    return (
        <div className="py-4 max-h-[400px] overflow-y-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Local</TableHead>
                        {forAdmin && <TableHead>Solicitante</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aberto Há</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tickets.map(ticket => (
                        <TableRow key={ticket.id}>
                            <TableCell className="font-mono">{ticket.ticketNumber}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{ticket.problemLocation}</TableCell>
                            {forAdmin && <TableCell>{ticket.requesterName}</TableCell>}
                            <TableCell><Badge variant={getStatusVariant(ticket.status)}>{getStatusLabel(ticket.status)}</Badge></TableCell>
                            <TableCell className="text-right">{formatDistanceToNow(new Date(ticket.createdAt as Date), { addSuffix: true, locale: ptBR })}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}


export function HelpModal({ isOpen, onClose, activeCompany }: HelpModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);

  const isAdmin = user?.uid === ADMIN_UID;

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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Central de Ajuda e Suporte
          </DialogTitle>
          <DialogDescription>
            Precisa de ajuda? Abra um chamado, acompanhe seus tickets ou consulte nossos links úteis.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="ticket" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ticket">Abrir Chamado</TabsTrigger>
                {isAdmin ? (
                    <TabsTrigger value="inbox"><Inbox className="mr-2 h-4 w-4"/> Caixa de Entrada</TabsTrigger>
                ) : (
                    <TabsTrigger value="my-tickets"><ListChecks className="mr-2 h-4 w-4"/> Meus Chamados</TabsTrigger>
                )}
                <TabsTrigger value="links">Links Úteis</TabsTrigger>
            </TabsList>
            <TabsContent value="ticket">
                {submittedTicket ? (
                     <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                        <TicketIcon className="h-12 w-12 text-green-500" />
                        <h3 className="text-xl font-bold">Chamado Enviado!</h3>
                        <p className="text-muted-foreground">Seu ticket de suporte foi aberto com o número:</p>
                        <p className="text-2xl font-mono p-2 bg-muted rounded-md">{submittedTicket}</p>
                        <p className="text-xs text-muted-foreground pt-4">Nossa equipe entrará em contato em breve. Você pode acompanhar o status na aba "Meus Chamados".</p>
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
            {isAdmin ? (
                 <TabsContent value="inbox">
                    <TicketList forAdmin={true} />
                 </TabsContent>
            ) : (
                 <TabsContent value="my-tickets">
                    <TicketList forAdmin={false} />
                 </TabsContent>
            )}
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
