
"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, DownloadCloud, Send, Trash2, MoreHorizontal, Eye, ChevronDown, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Company } from '@/types/company';
import type { EsocialEvent, EsocialEventStatus, EsocialEventType } from "@/types/esocial";
import { generateAndSaveEsocialEvent } from "@/services/esocial-generation-service";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function EsocialPage() {
    const [events, setEvents] = useState<EsocialEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState<string | null>(null);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const { user } = useAuth();
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
            setEvents([]);
            return;
        }

        setLoading(true);
        const eventsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/esocialEvents`);
        const q = query(eventsRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEvents(snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp)?.toDate(),
            } as EsocialEvent)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching eSocial events: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar eventos" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, activeCompany, toast]);

    const handleGenerate = async (eventType: EsocialEventType) => {
        if (!user || !activeCompany) return;
        setIsGenerating(true);
        try {
            await generateAndSaveEsocialEvent(user.uid, activeCompany, eventType);
            toast({ title: `Evento ${eventType} gerado com sucesso!`, description: "O arquivo está pronto para ser enviado." });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Erro ao gerar evento", description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSend = async (eventId: string) => {
        if (!user || !activeCompany) return;
        setIsSending(eventId);
        
        const eventRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/esocialEvents`, eventId);

        try {
            await updateDoc(eventRef, { status: 'sending' });
            
            // Simulating API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Simulating a random success/error response
            const isSuccess = Math.random() > 0.2; 
            if (isSuccess) {
                await updateDoc(eventRef, { status: 'success' });
                toast({ title: 'Evento enviado com sucesso!' });
            } else {
                 await updateDoc(eventRef, { status: 'error', errorDetails: 'Falha na comunicação com o portal do eSocial. Tente novamente.' });
                 toast({ variant: 'destructive', title: 'Falha no envio do evento.' });
            }

        } catch(error) {
            console.error("Error sending event: ", error);
            await updateDoc(eventRef, { status: 'error', errorDetails: 'Erro interno ao processar o envio.' });
            toast({ variant: 'destructive', title: "Erro no processo de envio" });
        } finally {
             setIsSending(null);
        }
    };

    const handleDelete = async (eventId: string) => {
         if (!user || !activeCompany) return;
         try {
             await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/esocialEvents`, eventId));
             toast({ title: "Evento excluído com sucesso." });
         } catch(error) {
             toast({ variant: 'destructive', title: "Erro ao excluir evento." });
         }
    };

    const handleDownload = (payload: string, type: EsocialEventType) => {
        const blob = new Blob([payload], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-${new Date().getTime()}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Download iniciado", description: `O arquivo ${a.download} está sendo baixado.` });
    };

    const getStatusBadge = (status: EsocialEventStatus) => {
        switch (status) {
            case 'pending': return <Badge variant="secondary">Pendente</Badge>;
            case 'sending': return <Badge variant="outline" className="text-blue-600 border-blue-600">Enviando...</Badge>;
            case 'success': return <Badge className="bg-green-600 hover:bg-green-700">Sucesso</Badge>;
            case 'error': return <Badge variant="destructive">Erro</Badge>;
            default: return <Badge variant="outline">Desconhecido</Badge>;
        }
    }


    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">eSocial - Central de Eventos</h1>
            
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Histórico de Envios</CardTitle>
                        <CardDescription>Acompanhe o status dos eventos gerados e envie-os para o portal do eSocial.</CardDescription>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button disabled={isGenerating || !activeCompany}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
                                {isGenerating ? 'Gerando...' : 'Gerar Novo Evento'}
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>Eventos de Tabela</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleGenerate('S-1005')}>S-1005 - Estabelecimentos</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGenerate('S-1010')}>S-1010 - Rubricas</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGenerate('S-1020')}>S-1020 - Lotações Tributárias</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Evento</TableHead>
                                <TableHead>Data de Geração</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>
                            ) : events.length === 0 ? (
                                 <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Nenhum evento gerado ainda.</TableCell></TableRow>
                            ) : events.map(event => (
                                <TableRow key={event.id}>
                                    <TableCell className="font-mono font-semibold">{event.type}</TableCell>
                                    <TableCell>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(event.createdAt as Date)}</TableCell>
                                    <TableCell>{getStatusBadge(event.status)}</TableCell>
                                    <TableCell className="text-right">
                                       <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSending === event.id}>
                                                <span className="sr-only">Abrir menu</span>
                                                {isSending === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                            </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleSend(event.id!)} disabled={event.status === 'success' || event.status === 'sending'}>
                                                    <Send className="mr-2 h-4 w-4" />
                                                    <span>{event.status === 'error' ? 'Reenviar' : 'Enviar'}</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDownload(event.payload, event.type)}>
                                                    <FileDown className="mr-2 h-4 w-4" />
                                                    <span>Baixar XML</span>
                                                </DropdownMenuItem>
                                                {event.status === 'error' && (
                                                    <DropdownMenuItem onClick={() => toast({ title: "Detalhes do Erro", description: event.errorDetails })}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        <span>Ver Erro</span>
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                              <Trash2 className="mr-2 h-4 w-4" />
                                                              Excluir
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta ação não pode ser desfeita. O evento será permanentemente removido.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(event.id!)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
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
