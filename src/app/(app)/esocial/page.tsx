
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, DownloadCloud, Send, Trash2, MoreHorizontal, Eye, ChevronDown, FileDown, Briefcase, CalendarClock, RefreshCw, ShieldCheck, UserPlus, FileSignature, AlertCircle } from "lucide-react";
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
import { EmployeeSelectionModal } from "@/components/pessoal/employee-selection-modal";
import type { Employee } from "@/types/employee";
import type { Admission } from "@/types/admission";
import { AdmissionForm } from "@/components/esocial/admission-form";

const realisticErrors = [
    "Erro de Validação [CBO]: O código '999999' informado no campo de Código Brasileiro de Ocupação é inválido. Verifique a tabela de CBO.",
    "Erro de Conexão: Timeout na comunicação com os servidores da Receita Federal. Verifique sua conexão e tente novamente.",
    "Conflito de Eventos: Já existe um evento S-1005 ativo para este estabelecimento. Para alterar dados, envie um evento de alteração (S-1005 - Alteração).",
    "Erro de Schema XML: A estrutura do arquivo XML não corresponde à versão do leiaute S-1.2. Verifique o payload gerado.",
    "Erro [CPF]: O CPF do responsável legal informado no evento não foi encontrado na base de dados da Receita Federal."
];

function getStatusBadge(status: EsocialEventStatus) {
    switch (status) {
        case 'pending': return <Badge variant="secondary">Pendente</Badge>;
        case 'processing': return <Badge variant="outline" className="text-blue-600 border-blue-600">Processando...</Badge>;
        case 'success': return <Badge className="bg-green-600 hover:bg-green-700">Sucesso</Badge>;
        case 'error': return <Badge variant="destructive">Erro</Badge>;
        default: return <Badge variant="outline">Desconhecido</Badge>;
    }
}


function TabEventosTabela({
    events,
    loading,
    activeCompany,
    onGenerate,
    isGenerating,
    actionHandlers
}: {
    events: EsocialEvent[],
    loading: boolean,
    activeCompany: Company | null,
    onGenerate: (eventType: EsocialEventType) => void,
    isGenerating: boolean,
    actionHandlers: any
}) {
    const { isProcessing, isCheckingStatus, handleProcess, handleCheckStatus, handleDelete, handleDownload } = actionHandlers;

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
                        <DropdownMenuItem onClick={() => onGenerate('S-1005')}>S-1005 - Estabelecimentos</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onGenerate('S-1010')}>S-1010 - Rubricas</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onGenerate('S-1020')}>S-1020 - Lotações Tributárias</DropdownMenuItem>
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
                                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleCheckStatus(event)} disabled={isCheckingStatus === event.id} title="Consultar Status">
                                                {isCheckingStatus === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                                                <DropdownMenuItem onClick={() => handleProcess(event.id!)} disabled={event.status !== 'pending'}>
                                                    <Send className="mr-2 h-4 w-4" />
                                                    <span>Processar Evento</span>
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

function TabEventosNaoPeriodicos({
    events,
    loading,
    activeCompany,
    userId,
    actionHandlers
}: {
    events: EsocialEvent[],
    loading: boolean,
    activeCompany: Company | null,
    userId: string | undefined,
    actionHandlers: any
}) {
    const [isEmployeeModalOpen, setEmployeeModalOpen] = useState(false);
    const [isAdmissionFormOpen, setAdmissionFormOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    const { isProcessing, isCheckingStatus, handleProcess, handleCheckStatus, handleDelete, handleDownload } = actionHandlers;

    const handleSelectEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setEmployeeModalOpen(false);
        setAdmissionFormOpen(true);
    };

    const handleAdmissionFormClose = () => {
        setAdmissionFormOpen(false);
        setSelectedEmployee(null);
    }
    
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Admissões (S-2200)</CardTitle>
                        <CardDescription>Gere e envie o evento de cadastramento inicial do vínculo de novos funcionários.</CardDescription>
                    </div>
                     <Button onClick={() => setEmployeeModalOpen(true)} disabled={!activeCompany}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Gerar Admissão
                    </Button>
                </CardHeader>
                 <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Funcionário</TableHead>
                                <TableHead>Data de Geração</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {loading ? (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>
                            ) : events.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Nenhuma admissão gerada ainda.</TableCell></TableRow>
                            ) : events.map(event => (
                                <TableRow key={event.id}>
                                    <TableCell>{(event.relatedDoc as Admission)?.employeeName || 'Carregando...'}</TableCell>
                                    <TableCell>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(event.createdAt as Date)}</TableCell>
                                    <TableCell>{getStatusBadge(event.status)}</TableCell>
                                    <TableCell className="text-right">
                                       <div className="flex items-center justify-end gap-2">
                                            {event.status !== 'pending' && (
                                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleCheckStatus(event)} disabled={isCheckingStatus === event.id} title="Consultar Status">
                                                    {isCheckingStatus === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                                                    <DropdownMenuItem onClick={() => handleProcess(event.id!)} disabled={event.status !== 'pending'}>
                                                        <Send className="mr-2 h-4 w-4" />
                                                        <span>Processar Evento</span>
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
                                                                <AlertDialogAction onClick={() => handleDelete(event.id!, event.relatedDocId, event.relatedCollection)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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

            <PlaceholderTab 
                title="Demais Eventos Não-Periódicos"
                description="As funcionalidades para os eventos S-2205 (Alteração Cadastral), S-2299 (Desligamento), entre outros, estarão disponíveis em breve."
                icon={FileSignature}
            />

            {activeCompany && userId && (
                <EmployeeSelectionModal 
                    isOpen={isEmployeeModalOpen}
                    onClose={() => setEmployeeModalOpen(false)}
                    onSelect={handleSelectEmployee}
                    userId={userId}
                    companyId={activeCompany.id}
                />
            )}
             {activeCompany && userId && selectedEmployee && (
                <AdmissionForm
                    isOpen={isAdmissionFormOpen}
                    onClose={handleAdmissionFormClose}
                    company={activeCompany}
                    employee={selectedEmployee}
                    userId={userId}
                />
            )}
        </div>
    );
}

function PlaceholderTab({ title, description, icon: Icon }: { title: string, description: string, icon: React.ElementType }) {
    return (
        <Card>
            <CardContent>
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 bg-muted rounded-full mb-4">
                        <Icon className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">{title}</h3>
                    <p className="text-muted-foreground mt-2 max-w-md mx-auto">{description}</p>
                </div>
            </CardContent>
        </Card>
    );
}


export default function EsocialPage() {
    const [allEvents, setAllEvents] = useState<EsocialEvent[]>([]);
    const [tableEvents, setTableEvents] = useState<EsocialEvent[]>([]);
    const [admissionEvents, setAdmissionEvents] = useState<EsocialEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [isCheckingStatus, setIsCheckingStatus] = useState<string | null>(null);
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
            setAllEvents([]);
            return;
        }

        setLoading(true);
        const eventsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/esocialEvents`);
        const q = query(eventsRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const eventsDataPromises = snapshot.docs.map(async (eventDoc) => {
                const eventData = eventDoc.data() as EsocialEvent;
                let relatedDocData = null;
                if (eventData.relatedDocId && eventData.relatedCollection) {
                    const relatedDocRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/${eventData.relatedCollection}`, eventData.relatedDocId);
                    const relatedDocSnap = await getDoc(relatedDocRef);
                    if (relatedDocSnap.exists()) {
                        relatedDocData = {
                            id: relatedDocSnap.id,
                            ...relatedDocSnap.data()
                        };
                    }
                }

                return {
                    id: eventDoc.id,
                    ...eventData,
                    createdAt: (eventData.createdAt as Timestamp)?.toDate(),
                    relatedDoc: relatedDocData
                } as EsocialEvent;
            });
            
            const resolvedEvents = await Promise.all(eventsDataPromises);
            setAllEvents(resolvedEvents);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching eSocial events: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar eventos do eSocial" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, activeCompany, toast]);

    useEffect(() => {
        const tableEventTypes: EsocialEventType[] = ['S-1005', 'S-1010', 'S-1020'];
        const admissionEventTypes: EsocialEventType[] = ['S-2200'];

        setTableEvents(allEvents.filter(event => tableEventTypes.includes(event.type)));
        setAdmissionEvents(allEvents.filter(event => admissionEventTypes.includes(event.type)));
    }, [allEvents]);

    const handleGenerateTableEvent = async (eventType: EsocialEventType) => {
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
            toast({ title: 'Evento enviado para processamento!', description: 'Aguarde alguns instantes e consulte o status.' });
        } catch(error) {
            console.error("Error processing event: ", error);
            await updateDoc(eventRef, { status: 'error', errorDetails: 'Erro interno ao enviar o evento.' });
            toast({ variant: 'destructive', title: "Erro no envio" });
        } finally {
             setIsProcessing(null);
        }
    };

    const handleCheckStatus = async (event: EsocialEvent) => {
        if (!user || !activeCompany || !event.id) return;
        
        if (event.status !== 'processing') {
             toast({
                title: `Status do Evento: ${event.type}`,
                description: `O status atual é: ${event.status}. ${event.status === 'error' ? 'Verifique os detalhes do erro.' : ''}`,
            });
            return;
        }

        setIsCheckingStatus(event.id);
        const eventRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/esocialEvents`, event.id);

        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const isSuccess = Math.random() > 0.3; 
            if (isSuccess) {
                await updateDoc(eventRef, { status: 'success' });
                toast({ title: 'Consulta de Status: Sucesso!', description: 'O evento foi aceito pelo eSocial.' });
            } else {
                 const randomError = realisticErrors[Math.floor(Math.random() * realisticErrors.length)];
                 await updateDoc(eventRef, { status: 'error', errorDetails: randomError });
                 toast({ variant: 'destructive', title: 'Consulta de Status: Erro!', description: 'O evento foi rejeitado pelo eSocial. Verifique os detalhes.' });
            }
        } catch(error) {
            console.error("Error checking status: ", error);
            await updateDoc(eventRef, { status: 'error', errorDetails: 'Erro interno ao consultar o status.' });
            toast({ variant: 'destructive', title: "Erro na consulta de status" });
        } finally {
            setIsCheckingStatus(null);
        }
    }

    const handleDelete = async (eventId: string, relatedDocId?: string, relatedCollection?: string) => {
         if (!user || !activeCompany) return;
         try {
             await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/esocialEvents`, eventId));
             if (relatedDocId && relatedCollection) {
                await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/${relatedCollection}`, relatedDocId));
             }
             toast({ title: "Evento e registro relacionado excluídos com sucesso." });
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

    const actionHandlers = {
        isProcessing,
        isCheckingStatus,
        handleProcess,
        handleCheckStatus,
        handleDelete,
        handleDownload
    };

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
                    <TabEventosTabela
                        events={tableEvents}
                        loading={loading}
                        activeCompany={activeCompany}
                        onGenerate={handleGenerateTableEvent}
                        isGenerating={isGenerating}
                        actionHandlers={actionHandlers}
                    />
                </TabsContent>
                <TabsContent value="nao-periodicos">
                     <TabEventosNaoPeriodicos
                        events={admissionEvents}
                        loading={loading}
                        activeCompany={activeCompany}
                        userId={user?.uid}
                        actionHandlers={actionHandlers}
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
