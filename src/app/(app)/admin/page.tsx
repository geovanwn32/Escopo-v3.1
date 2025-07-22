
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MoreHorizontal, CheckCircle, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Ticket, TicketStatus } from '@/types/ticket';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import type { Company } from '@/types/company';

const ADMIN_COMPANY_CNPJ = '00000000000000';

export default function AdminPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (user && companyId) {
            const companyDataString = sessionStorage.getItem(`company_${companyId}`);
            if (companyDataString) {
                const companyData = JSON.parse(companyDataString);
                setActiveCompany(companyData);
                if (companyData.cnpj !== ADMIN_COMPANY_CNPJ) {
                    toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Esta área é restrita a administradores.' });
                    router.push('/dashboard');
                }
            } else {
                 router.push('/dashboard');
            }
        } else if (!user) {
            router.push('/login');
        } else {
             router.push('/dashboard');
        }
    }
  }, [user, router, toast]);

  useEffect(() => {
    if (!activeCompany || activeCompany.cnpj !== ADMIN_COMPANY_CNPJ) {
        setLoading(false);
        return;
    }

    const ticketsRef = collection(db, `tickets`);
    const q = query(ticketsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const ticketsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate(),
            } as Ticket;
        });
        setTickets(ticketsData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching tickets: ", error);
        toast({
            variant: "destructive",
            title: "Erro ao buscar chamados",
        });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [activeCompany, toast]);

  const updateStatus = async (ticketId: string, status: TicketStatus) => {
    const ticketRef = doc(db, 'tickets', ticketId);
    try {
        await updateDoc(ticketRef, { status, updatedAt: new Date() });
        toast({ title: 'Status do chamado atualizado!' });
    } catch(error) {
        toast({ variant: 'destructive', title: 'Erro ao atualizar status.' });
    }
  }

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

  if (loading || !activeCompany || activeCompany.cnpj !== ADMIN_COMPANY_CNPJ) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Painel de Administração - Chamados</h1>
      <Card>
        <CardHeader>
          <CardTitle>Chamados de Suporte</CardTitle>
          <CardDescription>Gerencie os tickets de suporte abertos pelos usuários.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Local do Problema</TableHead>
                  <TableHead>Aberto Há</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono font-semibold">{ticket.ticketNumber}</TableCell>
                    <TableCell>{ticket.requesterCompanyName}</TableCell>
                    <TableCell>{ticket.requesterName}</TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.problemLocation}</TableCell>
                    <TableCell>{formatDistanceToNow(new Date(ticket.createdAt as Date), { addSuffix: true, locale: ptBR })}</TableCell>
                    <TableCell>
                        <Badge variant={getStatusVariant(ticket.status)}>
                            {getStatusLabel(ticket.status)}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateStatus(ticket.id!, 'in_progress')}>
                                <RefreshCw className="mr-2 h-4 w-4 text-blue-500" />
                                Marcar como "Em Progresso"
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => updateStatus(ticket.id!, 'closed')}>
                                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                Marcar como "Fechado"
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => updateStatus(ticket.id!, 'open')}>
                                <XCircle className="mr-2 h-4 w-4 text-red-500" />
                                Reabrir Chamado
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
