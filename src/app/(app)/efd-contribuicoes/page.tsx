
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, FileDigit, RefreshCcw, Eye, Trash2, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Company } from '@/types/company';
import { generateEfdContribuicoesTxt } from "@/services/efd-contribuicoes-service";
import { Checkbox } from "@/components/ui/checkbox";
import { collection, onSnapshot, orderBy, query, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EfdFile } from "@/types";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";


export default function EfdContribuicoesPage() {
    const [period, setPeriod] = useState<string>('');
    const [semMovimento, setSemMovimento] = useState(false);
    const [tipoEscrituracao, setTipoEscrituracao] = useState<'0' | '1'>('0'); // 0: Original, 1: Retificadora
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [closedPeriods, setClosedPeriods] = useState<string[]>([]);
    const [loadingClosures, setLoadingClosures] = useState(true);
    const [generatedFiles, setGeneratedFiles] = useState<EfdFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(true);

    const { user } = useAuth();
    const { toast } = useToast();
    
    useEffect(() => {
        // Default to the previous month
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
            setLoadingClosures(false);
            setLoadingFiles(false);
            setClosedPeriods([]);
            setGeneratedFiles([]);
            return;
        }

        setLoadingClosures(true);
        const closuresRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/fiscalClosures`);
        const unsubClosures = onSnapshot(closuresRef, (snapshot) => {
            const periods = snapshot.docs.map(doc => doc.id); // doc.id is 'YYYY-MM'
            setClosedPeriods(periods);
            setLoadingClosures(false);
        }, (error) => {
            console.error("Error fetching closures: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar períodos fechados" });
            setLoadingClosures(false);
        });

        setLoadingFiles(true);
        const filesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/efdFiles`);
        const qFiles = query(filesRef, orderBy('createdAt', 'desc'));
        const unsubFiles = onSnapshot(qFiles, (snapshot) => {
            const filesData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
                } as EfdFile;
            });
            setGeneratedFiles(filesData);
            setLoadingFiles(false);
        });

        return () => {
            unsubClosures();
            unsubFiles();
        };
    }, [user, activeCompany, toast]);

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
            const result = await generateEfdContribuicoesTxt(user.uid, activeCompany, period, semMovimento, tipoEscrituracao);
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
            console.error("Erro ao gerar arquivo EFD:", error);
            toast({ variant: 'destructive', title: 'Erro ao gerar arquivo', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleDeleteFile = async (fileId: string) => {
         if (!user || !activeCompany) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/efdFiles`, fileId));
            toast({ title: "Registro de arquivo excluído." });
        } catch (error) {
             toast({ variant: "destructive", title: "Erro ao excluir registro." });
        }
    }
    
    const handleRegenerate = (file: EfdFile) => {
        setPeriod(file.period);
        setTipoEscrituracao(file.type);
        setSemMovimento(file.isSemMovimento);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const formattedPeriodId = period.split('/').reverse().join('-');
    const isPeriodClosed = closedPeriods.includes(formattedPeriodId);
    const isButtonDisabled = isGenerating || !activeCompany || loadingClosures || (!isPeriodClosed && !semMovimento);


    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">EFD Contribuições</h1>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileDigit className="h-6 w-6 text-primary" />
                        Gerador de Arquivo EFD Contribuições
                    </CardTitle>
                    <CardDescription>Selecione o período de competência para gerar o arquivo TXT para importação no programa da Receita Federal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="period">Período de Competência (MM/AAAA)</Label>
                            <Input 
                                id="period" 
                                placeholder="Ex: 07/2024" 
                                value={period} 
                                onChange={handlePeriodChange} 
                                maxLength={7} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tipo-escrituracao">Tipo de Escrituração</Label>
                             <Select value={tipoEscrituracao} onValueChange={(v) => setTipoEscrituracao(v as '0' | '1')}>
                                <SelectTrigger id="tipo-escrituracao">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">0 - Original</SelectItem>
                                    <SelectItem value="1">1 - Retificadora</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="sem-movimento" checked={semMovimento} onCheckedChange={(checked) => setSemMovimento(Boolean(checked))} />
                        <label
                            htmlFor="sem-movimento"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Gerar arquivo sem movimento
                        </label>
                    </div>
                    {!isPeriodClosed && !semMovimento && (
                        <p className="text-xs text-center text-destructive">
                            O período <span className="font-bold">{period}</span> precisa ser fechado no <Link href="/fiscal/apuracao" className="underline hover:text-destructive/80">módulo de Apuração</Link> antes de gerar o arquivo.
                        </p>
                    )}
                </CardContent>
                 <CardFooter className="flex-col items-start gap-4">
                     <Button onClick={handleGenerateFile} className="w-full" disabled={isButtonDisabled}>
                        {isGenerating || loadingClosures ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        {isGenerating ? 'Gerando...' : 'Gerar Arquivo TXT'}
                    </Button>
                    <p className="text-xs text-muted-foreground">O arquivo gerado conterá os blocos 0, A, C e M, com base nas notas fiscais de saída e serviços lançadas no sistema. Se "sem movimento" for selecionado, os blocos serão gerados vazios.</p>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Arquivos Gerados</CardTitle>
                    <CardDescription>Visualize os arquivos EFD Contribuições gerados anteriormente.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingFiles ? (
                         <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : generatedFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="p-4 bg-muted rounded-full mb-4">
                                <FileDigit className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-semibold">Nenhum arquivo no histórico</h3>
                            <p className="text-muted-foreground mt-2">Os arquivos que você gerar aparecerão aqui.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Competência</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Movimento</TableHead>
                                    <TableHead>Data de Geração</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {generatedFiles.map(file => (
                                    <TableRow key={file.id}>
                                        <TableCell className="font-mono">{file.period}</TableCell>
                                        <TableCell>{file.type === '0' ? 'Original' : 'Retificadora'}</TableCell>
                                        <TableCell>{file.isSemMovimento ? 'Não' : 'Sim'}</TableCell>
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
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Confirmar Exclusão?</AlertDialogTitle>
                                                                <AlertDialogDescription>Esta ação removerá apenas o registro do histórico, não o arquivo baixado. Deseja continuar?</AlertDialogDescription>
                                                            </AlertDialogHeader>
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
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
