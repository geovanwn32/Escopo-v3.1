
"use client";

import { useState, useEffect } from 'react';
import { collectionGroup, getDocs, doc, updateDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Ticket } from '@/types/ticket';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, MoreHorizontal } from "lucide-react";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TicketStatus } from '@/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const statusMap: Record<TicketStatus, string> = {
    open: 'Aberto',
    in_progress: 'Em Progresso',
    closed: 'Fechado',
};

const statusVariantMap: Record<TicketStatus, "default" | "secondary" | "destructive" | "outline"> = {
    open: 'destructive',
    in_progress: 'outline',
    closed: 'secondary',
};

export default function AllTicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const { user: adminUser } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (!adminUser) {
            setLoading(false);
            return;
        }

        const ticketsQuery = query(collectionGroup(db, 'tickets'), orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
            const ticketsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Reconstruct path for updates
                    _path: doc.ref.path,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                } as Ticket & { _path: string };
            });
            setTickets(ticketsData);
            setLoading(false);
        }, async (error) => {
            console.error("Error fetching tickets:", error);
            const permissionError = new FirestorePermissionError({
                path: `tickets (collectionGroup)`,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Erro ao buscar chamados.' });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [adminUser, toast]);

    const handleUpdateStatus = async (ticket: Ticket & { _path: string }, newStatus: TicketStatus) => {
        setIsUpdating(ticket.id!);
        const ticketRef = doc(db, ticket._path);
        
        updateDoc(ticketRef, { status: newStatus, updatedAt: serverTimestamp() }).then(() => {
            toast({ title: 'Status do chamado atualizado!' });
            setIsUpdating(null);
        }).catch(async (serverError) => {
             const permissionError = new FirestorePermissionError({
                path: ticketRef.path,
                operation: 'update',
                requestResourceData: { status: newStatus, updatedAt: 'SERVER_TIMESTAMP' },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Erro ao atualizar status.' });
            setIsUpdating(null);
        });
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                 <Button variant="outline" size="icon" asChild>
                    <Link href="/admin">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Voltar</span>
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Todos os Chamados de Suporte</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Chamados</CardTitle>
                    <CardDescription>
                        Visualize e gerencie todos os chamados abertos no sistema.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nº Chamado</TableHead>
                                <TableHead>Empresa</TableHead>
                                <TableHead>Problema</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tickets.map((ticket) => (
                                <TableRow key={ticket.id}>
                                    <TableCell className="font-mono">{ticket.ticketNumber}</TableCell>
                                    <TableCell className="font-medium">{ticket.requesterCompanyName}</TableCell>
                                    <TableCell className="max-w-xs truncate">{ticket.problemLocation}</TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariantMap[ticket.status]}>
                                            {statusMap[ticket.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                         {formatDistanceToNow(ticket.createdAt, { addSuffix: true, locale: ptBR })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={isUpdating === ticket.id}>
                                                    {isUpdating === ticket.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuLabel>Alterar Status</DropdownMenuLabel>
                                                {Object.keys(statusMap).map(statusKey => (
                                                    <DropdownMenuItem 
                                                        key={statusKey} 
                                                        disabled={ticket.status === statusKey}
                                                        onClick={() => handleUpdateStatus(ticket as Ticket & { _path: string }, statusKey as TicketStatus)}
                                                    >
                                                        {statusMap[statusKey as keyof typeof statusMap]}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
