
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, RefreshCcw, MoreHorizontal, Trash2, ListChecks, FileWarning, Beaker, Send, Lock, FileDown, Eye, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Company } from '@/types/company';
import { collection, onSnapshot, orderBy, query, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReinfFile, Launch } from '@/types';
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { generateReinfEvents } from "@/services/reinf-service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReinfDetailsModal } from "@/components/reinf/reinf-details-modal";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


const reinfEvents = [
    { id: "geral", label: "Geral" },
    { id: "R-1000", label: "R-1000" },
    { id: "R-1070", label: "R-1070" },
    { id: "R-2010", label: "R-2010" },
    { id: "R-2020", label: "R-2020" },
    { id: "R-2030", label: "R-2030" },
    { id: "R-2040", label: "R-2040" },
    { id: "R-2050", label: "R-2050" },
    { id: "R-2055", label: "R-2055" },
    { id: "R-2060", label: "R-2060" },
    { id: "R-2099", label: "R-2099" },
    { id: "R-4010", label: "R-4010" },
    { id: "R-4020", label: "R-4020" },
];

function PlaceholderContent({ eventId }: { eventId: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center border-t">
            <div className="p-4 bg-muted rounded-full mb-4">
                <FileWarning className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Evento {eventId} em Desenvolvimento</h3>
            <p className="text-muted-foreground mt-2 max-w-md">A funcionalidade para gerar e gerenciar este evento ainda não está disponível.</p>
        </div>
    )
}

export default function ReinfPage() {
    const [period, setPeriod] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [generatedFiles, setGeneratedFiles] = useState<ReinfFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [selectedFileForDetails, setSelectedFileForDetails] = useState<ReinfFile | null>(null);

    const { user } = useAuth();
    const { toast } = useToast();
    
    useEffect(() => {
        const now = new Date();
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonth = prevMonthDate.getMonth() + 1;
        const prevYear = prevMonthDate.getFullYear();
        setPeriod(`${String(prevMonth).padStart(2, '0')}/${prevYear}`);

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
            setLoadingFiles(false);
            setGeneratedFiles([]);
            return;
        }

        setLoadingFiles(true);
        const filesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/reinfFiles`);
        const qFiles = query(filesRef, orderBy('createdAt', 'desc'));
        const unsubFiles = onSnapshot(qFiles, (snapshot) => {
            const filesData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
                } as ReinfFile;
            });
            setGeneratedFiles(filesData);
            setLoadingFiles(false);
        });

        return () => unsubFiles();
    }, [user, activeCompany, toast]);

    const summary = useMemo(() => {
        const total = generatedFiles.length;
        const pendentes = generatedFiles.filter(f => f.status === 'pending').length;
        const enviados = generatedFiles.filter(f => f.status === 'success').length;
        const erros = generatedFiles.filter(f => f.status === 'error').length;
        return { total, pendentes, enviados, correcao: 0, erro: erros, finalizados: enviados };
    }, [generatedFiles]);

    const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, ''); 
        if (value.length > 2) {
            value = `${value.slice(0, 2)}/${value.slice(2, 6)}`;
        }
        setPeriod(value);
    };

    const handleGenerateFile = async () => {
        if (!user || !activeCompany) {
            toast({ variant: 'destructive', title: 'Usuário ou empresa não identificados.' });
            return;
        }

        const periodRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
        if (!periodRegex.test(period)) {
            toast({ variant: 'destructive', title: 'Período inválido', description: 'Por favor, insira um período no formato MM/AAAA.' });
            return;
        }

        setIsGenerating(true);
        try {
            const result = await generateReinfEvents(user.uid, activeCompany, period);
             if (!result.success) {
                toast({
                    variant: "destructive",
                    title: "Não foi possível gerar os eventos",
                    description: result.message,
                });
            } else {
                 toast({ title: "Eventos Gerados!", description: result.message });
            }
        } catch (error) {
            console.error("Erro ao gerar eventos EFD-Reinf:", error);
            toast({ variant: 'destructive', title: 'Erro ao gerar eventos', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleDeleteFile = async (fileId: string) => {
         if (!user || !activeCompany) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/reinfFiles`, fileId));
            toast({ title: "Registro de evento excluído." });
        } catch (error) {
             toast({ variant: "destructive", title: "Erro ao excluir registro." });
        }
    }
    
    const renderEventTable = (eventType: string) => {
        const filteredFiles = generatedFiles.filter(f => f.type === eventType);
         if (loadingFiles) return <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
        if (filteredFiles.length === 0) return <div className="text-center py-20 text-muted-foreground border-t">Nenhum evento {eventType} encontrado para os períodos apurados.</div>
        
        return (
            <div className="border-t">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Competência</TableHead>
                            <TableHead>Data de Geração</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredFiles.map(file => (
                            <TableRow key={file.id}>
                                <TableCell className="font-mono">{file.period}</TableCell>
                                <TableCell>{format(file.createdAt as Date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                <TableCell>
                                    <Badge variant={file.status === 'success' ? 'success' : file.status === 'error' ? 'destructive' : 'secondary'}>
                                        {file.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                             <DropdownMenuItem onClick={() => setSelectedFileForDetails(file)}>
                                                <Eye className="mr-2 h-4 w-4" /> Visualizar Detalhes
                                            </DropdownMenuItem>
                                             <DropdownMenuItem onClick={() => handleGenerateFile()} disabled={isGenerating}>
                                                <RefreshCcw className="mr-2 h-4 w-4" /> Gerar Novamente
                                            </DropdownMenuItem>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Excluir Registro
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Confirmar Exclusão?</AlertDialogTitle><AlertDialogDescription>Esta ação removerá apenas o registro do histórico, não o arquivo baixado. Deseja continuar?</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteFile(file.id!)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
            </div>
        )
    }

    const SummaryItem = ({ label, value }: { label: string, value: string | number}) => (
        <div className="flex flex-col">
            <Label className="text-sm text-muted-foreground">{label}</Label>
            <p className="text-lg font-bold">{value}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">EFD-Reinf - Central de Eventos</h1>

             <Alert variant="default" className="border-amber-500/50 text-amber-700 [&>svg]:text-amber-600">
                <Beaker className="h-4 w-4" />
                <AlertTitle>Funcionalidade Parcial em Modo de Simulação</AlertTitle>
                <AlertDescription>
                   Este módulo atualmente gera os eventos R-1000, R-2010, R-2020, R-4010, R-4020 e R-2099. Os eventos não são transmitidos para o governo.
                </AlertDescription>
            </Alert>
            
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle>Painel de Controle EFD-Reinf</CardTitle>
                            <CardDescription>Configure o período de apuração para gerar e enviar seus eventos.</CardDescription>
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <Settings className="h-4 w-4"/>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                                <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Configurações de Ambiente</h4>
                                    <p className="text-sm text-muted-foreground">
                                    Selecione o ambiente para transmissão dos eventos.
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                        <Label htmlFor="tipo-ambiente">Tipo de Ambiente</Label>
                                        <Select defaultValue="2">
                                        <SelectTrigger id="tipo-ambiente"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">1 - Produção</SelectItem>
                                            <SelectItem value="2">2 - Pré-Produção (dados reais)</SelectItem>
                                        </SelectContent>
                                        </Select>
                                </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="period">Data de Referência</Label>
                             <Input id="period" placeholder="MM/AAAA" value={period} onChange={handlePeriodChange} maxLength={7} />
                        </div>
                        <div className="space-y-2 lg:col-span-2 flex items-end gap-2">
                             <Button className="w-full" onClick={handleGenerateFile} disabled={isGenerating || !activeCompany}>
                                 {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>} Gerar Eventos
                            </Button>
                             <Button className="w-full" variant="outline"><Send className="mr-2 h-4 w-4"/> Enviar Pendentes</Button>
                             <Button className="w-full" variant="destructive"><Lock className="mr-2 h-4 w-4"/> Fechar Período</Button>
                        </div>
                    </div>
                </CardContent>

                <Tabs defaultValue="geral" className="w-full">
                    <CardHeader className="p-0">
                         <TabsList className="m-4">
                            {reinfEvents.map(event => (
                                <TabsTrigger key={event.id} value={event.id}>{event.label}</TabsTrigger>
                            ))}
                        </TabsList>
                    </CardHeader>

                    <TabsContent value="geral" className="p-6">
                        <Card className="bg-muted/50">
                            <CardContent className="py-4">
                                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-4 text-sm items-center">
                                    <SummaryItem label="Total de Eventos" value={summary.total} />
                                    <SummaryItem label="Eventos Pendentes" value={summary.pendentes} />
                                    <SummaryItem label="Eventos Enviados" value={summary.enviados} />
                                    <SummaryItem label="Eventos c/ Erro" value={summary.erro} />
                                    <SummaryItem label="Eventos Finalizados" value={summary.finalizados} />
                                 </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="R-1000">{renderEventTable("R-1000")}</TabsContent>
                    <TabsContent value="R-1070"><PlaceholderContent eventId="R-1070" /></TabsContent>
                    <TabsContent value="R-2010">{renderEventTable("R-2010")}</TabsContent>
                    <TabsContent value="R-2020">{renderEventTable("R-2020")}</TabsContent>
                    <TabsContent value="R-2030"><PlaceholderContent eventId="R-2030" /></TabsContent>
                    <TabsContent value="R-2040"><PlaceholderContent eventId="R-2040" /></TabsContent>
                    <TabsContent value="R-2050"><PlaceholderContent eventId="R-2050" /></TabsContent>
                    <TabsContent value="R-2055"><PlaceholderContent eventId="R-2055" /></TabsContent>
                    <TabsContent value="R-2060"><PlaceholderContent eventId="R-2060" /></TabsContent>
                    <TabsContent value="R-2099">{renderEventTable("R-2099")}</TabsContent>
                    <TabsContent value="R-4010">{renderEventTable("R-4010")}</TabsContent>
                    <TabsContent value="R-4020">{renderEventTable("R-4020")}</TabsContent>
                </Tabs>
            </Card>

            {user && activeCompany && selectedFileForDetails && (
                <ReinfDetailsModal
                    isOpen={!!selectedFileForDetails}
                    onClose={() => setSelectedFileForDetails(null)}
                    userId={user.uid}
                    companyId={activeCompany.id}
                    file={selectedFileForDetails}
                />
            )}
        </div>
    );
}
