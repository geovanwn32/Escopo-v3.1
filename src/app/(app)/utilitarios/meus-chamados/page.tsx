
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company, Ticket } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Ticket as TicketIcon, MessageSquareWarning } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase.tsx';

const statusMap = {
    open: 'Aberto',
    in_progress: 'Em Progresso',
    closed: 'Fechado',
};

const statusVariantMap = {
    open: 'destructive' as const,
    in_progress: 'outline' as const,
    closed: 'secondary' as const,
};

export default function MeusChamadosPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const companyId = sessionStorage.getItem('activeCompanyId');
            if (user && companyId) {
                const companyDataString = sessionStorage.getItem(`company_${companyId}`);
                if (companyDataString) {
                    setActiveCompany(JSON.parse(companyDataString));
                }
            }
        }
    }, [user]);

    useEffect(() => {
        if (!user || !activeCompany) {
            setLoading(false);
            return;
        }

        const ticketsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/tickets`);
        const q = query(ticketsRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ticketsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
                } as Ticket;
            });
            setTickets(ticketsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching tickets:", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar chamados.', description: error.message });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, activeCompany, toast]);

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <TicketIcon className="h-6 w-6" />
                <h1 className="text-2xl font-bold">Meus Chamados de Suporte</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Chamados</CardTitle>
                    <CardDescription>
                        Acompanhe o status e o histórico das suas solicitações de suporte.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="p-4 bg-muted rounded-full mb-4">
                                <MessageSquareWarning className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-semibold">Nenhum chamado encontrado</h3>
                            <p className="text-muted-foreground mt-2">
                                Você ainda não abriu nenhum chamado de suporte para esta empresa.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nº Chamado</TableHead>
                                    <TableHead>Módulo/Tela</TableHead>
                                    <TableHead>Descrição do Problema</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Data</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tickets.map((ticket) => (
                                    <TableRow key={ticket.id}>
                                        <TableCell className="font-mono">{ticket.ticketNumber}</TableCell>
                                        <TableCell className="font-medium">{ticket.problemLocation}</TableCell>
                                        <TableCell className="max-w-xs truncate text-muted-foreground">{ticket.description}</TableCell>
                                        <TableCell>
                                            <Badge variant={statusVariantMap[ticket.status]}>
                                                {statusMap[ticket.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatDistanceToNow(ticket.createdAt as Date, { addSuffix: true, locale: ptBR })}
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
