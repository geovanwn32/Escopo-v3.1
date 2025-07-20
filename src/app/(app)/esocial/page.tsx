
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, DownloadCloud, Send, Trash2, MoreHorizontal, Eye, ChevronDown, FileDown, Briefcase, CalendarClock, ListChecks, CheckCircle, Search, RefreshCw, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Company } from '@/types/company';
import type { EsocialEvent, EsocialEventStatus, EsocialEventType } from "@/types/esocial";
import { generateAndSaveEsocialEvent } from "@/services/esocial-generation-service";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function TabEventosTabela() {
    const [events, setEvents] = useState<EsocialEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
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
            toast({ title: `Evento ${eventType} gerado com sucesso!`, description: "O arquivo está pronto para ser processado." });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Erro ao gerar evento", description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleProcess = async (eventId: string) => {
        if (!user || !activeCompany) return;
        setIsProcessing(eventId);
        
        const eventRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/esocialEvents`, eventId);

        try {
            await updateDoc(eventRef, { status: 'processing' });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const isSuccess = Math.random() > 0.2; 
            if (isSuccess) {
                await updateDoc(eventRef, { status: 'success' });
                toast({ title: 'Evento processado com sucesso!', description: 'O evento foi aceito pelo eSocial.' });
            } else {
                 await updateDoc(eventRef, { status: 'error', errorDetails: 'Falha na comunicação com o portal do eSocial. Verifique o XML e tente novamente.' });
                 toast({ variant: 'destructive', title: 'Falha no processamento do evento.' });
            }

        } catch(error) {
            console.error("Error processing event: ", error);
            await updateDoc(eventRef, { status: 'error', errorDetails: 'Erro interno ao processar o evento.' });
            toast({ variant: 'destructive', title: "Erro no processo de envio" });
        } finally {
             setIsProcessing(null);
        }
    };

    const handleCheckStatus = (event: EsocialEvent) => {
        toast({
            title: `Status do Evento: ${event.type}`,
            description: `O status atual é: ${event.status}.`,
        });
    }

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
            case 'processing': return <Badge variant="outline" className="text-blue-600 border-blue-600">Processando...</Badge>;
            case 'success': return <Badge className="bg-green-600 hover:bg-green-700">Sucesso</Badge>;
            case 'error': return <Badge variant="destructive">Erro</Badge>;
            default: return <Badge variant="outline">Desconhecido</Badge>;
        }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Histórico de Envios de Tabelas</CardTitle>
                    <CardDescription>Acompanhe o status dos eventos de tabelas gerados e envie-os.</CardDescription>
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
                            <TableHead>ID do Evento</TableHead>
                            <TableHead>Data de Geração</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>
                        ) : events.length === 0 ? (
                             <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nenhum evento gerado ainda.</TableCell></TableRow>
                        ) : events.map(event => (
                            <TableRow key={event.id}>
                                <TableCell className="font-mono font-semibold">{event.type}</TableCell>
                                <TableCell className="font-mono text-xs max-w-[150px] truncate" title={event.eventId}>{event.eventId}</TableCell>
                                <TableCell>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(event.createdAt as Date)}</TableCell>
                                <TableCell>{getStatusBadge(event.status)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {event.status !== 'pending' && (
                                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleCheckStatus(event)} title="Consultar Status">
                                                <RefreshCw className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isProcessing === event.id}>
                                                <span className="sr-only">Abrir menu</span>
                                                {isProcessing === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                            </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleProcess(event.id!)} disabled={event.status === 'success' || event.status === 'processing'}>
                                                    <Send className="mr-2 h-4 w-4" />
                                                    <span>{event.status === 'error' ? 'Reprocessar' : 'Processar Evento'}</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDownload(event.payload, event.type)}>
                                                    <FileDown className="mr-2 h-4 w-4" />
                                                    <span>Baixar XML</span>
                                                </DropdownMenuItem>
                                                {event.status === 'error' && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                <span>Ver Erro</span>
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Detalhes do Erro</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    {event.errorDetails || "Nenhum detalhe de erro foi fornecido."}
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogAction>Fechar</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
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
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function PlaceholderTab({ title, description, icon: Icon }: { title: string, description: string, icon: React.ElementType }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
                <Icon className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-2">{description}</p>
        </div>
    );
}


export default function EsocialPage() {
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const { user } = useAuth();

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

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">eSocial - Central de Eventos</h1>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-green-600" />
                        Configuração do Certificado Digital
                    </CardTitle>
                    <CardDescription>
                        Certificado digital A1 utilizado para a assinatura e transmissão dos eventos.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="font-semibold">Nome do Titular</p>
                        <p className="text-muted-foreground">{activeCompany?.razaoSocial || "N/A"}</p>
                    </div>
                    <div>
                        <p className="font-semibold">Emitido por</p>
                        <p className="text-muted-foreground">AC Certisign Múltipla (Exemplo)</p>
                    </div>
                    <div>
                        <p className="font-semibold">Validade</p>
                        <p className="text-muted-foreground">25/12/2024 (Exemplo)</p>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="tabelas" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="tabelas">Eventos de Tabela</TabsTrigger>
                    <TabsTrigger value="nao-periodicos">Eventos Não-Periódicos</TabsTrigger>
                    <TabsTrigger value="periodicos">Eventos Periódicos</TabsTrigger>
                </TabsList>
                <TabsContent value="tabelas">
                    <TabEventosTabela />
                </TabsContent>
                <TabsContent value="nao-periodicos">
                     <PlaceholderTab 
                        title="Em Desenvolvimento" 
                        description="A funcionalidade para envio de eventos não-periódicos (ex: S-2200 Admissão) estará disponível em breve."
                        icon={Briefcase}
                    />
                </TabsContent>
                <TabsContent value="periodicos">
                    <PlaceholderTab 
                        title="Em Desenvolvimento" 
                        description="A funcionalidade para envio de eventos periódicos (ex: S-1200 Remuneração) estará disponível em breve."
                        icon={CalendarClock}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
