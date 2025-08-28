
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, RefreshCcw, MoreHorizontal, Trash2, ListChecks, FileWarning, Beaker } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Company } from '@/types/company';
import { collection, onSnapshot, orderBy, query, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReinfFile } from "@/types";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { generateReinfXml } from "@/services/reinf-service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const reinfEvents = [
    { id: "geral", label: "Geral" },
    { id: "R1000", label: "R-1000" },
    { id: "R1070", label: "R-1070" },
    { id: "R2010", label: "R-2010" },
    { id: "R2020", label: "R-2020" },
    { id: "R2030", label: "R-2030" },
    { id: "R2040", label: "R-2040" },
    { id: "R2050", label: "R-2050" },
    { id: "R2055", label: "R-2055" },
    { id: "R2060", label: "R-2060" },
    { id: "R2098", label: "R-2098" },
    { id: "R2099", label: "R-2099" },
    { id: "R4010", label: "R-4010" },
    { id: "R4020", label: "R-4020" },
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
        // This is a placeholder for a real status logic
        const pendentes = generatedFiles.filter(f => f.status === 'pending').length;
        const enviados = generatedFiles.filter(f => f.status === 'success').length;
        return { total, pendentes, enviados, correcao: 0, erro: 0, finalizados: 0 };
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
            const result = await generateReinfXml(user.uid, activeCompany, period);
             if (!result.success) {
                toast({
                    variant: "destructive",
                    title: "Não foi possível gerar o arquivo",
                    description: result.message,
                });
            } else {
                 toast({ title: "Arquivo Gerado!", description: result.message });
            }
        } catch (error) {
            console.error("Erro ao gerar arquivo EFD-Reinf:", error);
            toast({ variant: 'destructive', title: 'Erro ao gerar arquivo', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleDeleteFile = async (fileId: string) => {
         if (!user || !activeCompany) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/reinfFiles`, fileId));
            toast({ title: "Registro de arquivo excluído." });
        } catch (error) {
             toast({ variant: "destructive", title: "Erro ao excluir registro." });
        }
    }
    
    const handleRegenerate = (file: ReinfFile) => {
        setPeriod(file.period);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const renderEventTable = (eventType: string) => {
        const filteredFiles = generatedFiles.filter(f => f.type === eventType);
         if (loadingFiles) return <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
        if (filteredFiles.length === 0) return <div className="text-center py-20 text-muted-foreground">Nenhum evento {eventType} encontrado neste período.</div>
        
        return (
            <div className="border-t">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Competência</TableHead>
                            <TableHead>Data de Geração</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredFiles.map(file => (
                            <TableRow key={file.id}>
                                <TableCell className="font-mono">{file.period}</TableCell>
                                <TableCell>{format(file.createdAt as Date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleRegenerate(file)}>
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

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">EFD-Reinf - Central de Eventos</h1>

             <Alert variant="default" className="border-amber-500/50 text-amber-700 [&>svg]:text-amber-600">
                <Beaker className="h-4 w-4" />
                <AlertTitle>Funcionalidade Parcial</AlertTitle>
                <AlertDescription>
                   Este módulo atualmente gera os eventos R-1000, R-2010 (Serviços Tomados com retenção de INSS) e R-2099 (Fechamento). O suporte aos demais eventos será adicionado em breve.
                </AlertDescription>
            </Alert>
            
            <Card>
                <Tabs defaultValue="geral" className="w-full">
                    <TabsList className="m-4">
                        {reinfEvents.map(event => (
                            <TabsTrigger key={event.id} value={event.id}>{event.label}</TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="geral">
                        <CardHeader>
                            <CardTitle>Painel Geral da EFD-Reinf</CardTitle>
                            <CardDescription>Resumo dos eventos e geração de novos arquivos.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <div className="p-4 border rounded-lg text-center"><p className="text-xs text-muted-foreground">Total de Eventos</p><p className="text-2xl font-bold">{summary.total}</p></div>
                                <div className="p-4 border rounded-lg text-center"><p className="text-xs text-muted-foreground">Eventos Pendentes</p><p className="text-2xl font-bold">{summary.pendentes}</p></div>
                                <div className="p-4 border rounded-lg text-center"><p className="text-xs text-muted-foreground">Eventos Enviados</p><p className="text-2xl font-bold">{summary.enviados}</p></div>
                                <div className="p-4 border rounded-lg text-center"><p className="text-xs text-muted-foreground">Aguard. Correção</p><p className="text-2xl font-bold">{summary.correcao}</p></div>
                                <div className="p-4 border rounded-lg text-center"><p className="text-xs text-muted-foreground">Erro Prioritário</p><p className="text-2xl font-bold">{summary.erro}</p></div>
                                <div className="p-4 border rounded-lg text-center"><p className="text-xs text-muted-foreground">Eventos Finalizados</p><p className="text-2xl font-bold">{summary.finalizados}</p></div>
                            </div>
                             <div className="flex flex-col sm:flex-row items-end gap-4 p-4 border rounded-lg bg-muted/50">
                                <div className="grid w-full max-w-xs items-center gap-1.5">
                                    <Label htmlFor="period">Competência (MM/AAAA)</Label>
                                    <Input 
                                        id="period" 
                                        placeholder="Ex: 07/2024" 
                                        value={period} 
                                        onChange={handlePeriodChange} 
                                        maxLength={7} 
                                    />
                                </div>
                                <Button onClick={handleGenerateFile} className="w-full sm:w-auto" disabled={isGenerating || !activeCompany}>
                                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                    {isGenerating ? 'Gerando...' : 'Gerar Arquivo XML do Período'}
                                </Button>
                            </div>
                        </CardContent>
                    </TabsContent>
                    <TabsContent value="R1000"><PlaceholderContent eventId="R-1000" /></TabsContent>
                    <TabsContent value="R1070"><PlaceholderContent eventId="R-1070" /></TabsContent>
                    <TabsContent value="R2010">{renderEventTable("R-2010")}</TabsContent>
                    <TabsContent value="R2020">{renderEventTable("R-2020")}</TabsContent>
                    <TabsContent value="R2030"><PlaceholderContent eventId="R-2030" /></TabsContent>
                    <TabsContent value="R2040"><PlaceholderContent eventId="R-2040" /></TabsContent>
                    <TabsContent value="R2050"><PlaceholderContent eventId="R-2050" /></TabsContent>
                    <TabsContent value="R2055"><PlaceholderContent eventId="R-2055" /></TabsContent>
                    <TabsContent value="R2060"><PlaceholderContent eventId="R-2060" /></TabsContent>
                    <TabsContent value="R2098"><PlaceholderContent eventId="R-2098" /></TabsContent>
                    <TabsContent value="R2099">{renderEventTable("R-2099")}</TabsContent>
                    <TabsContent value="R4010"><PlaceholderContent eventId="R-4010" /></TabsContent>
                    <TabsContent value="R4020"><PlaceholderContent eventId="R-4020" /></TabsContent>
                </Tabs>
            </Card>
        </div>
    );
}
