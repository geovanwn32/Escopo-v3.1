
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, RefreshCcw, MoreHorizontal, Trash2 } from "lucide-react";
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

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">EFD-Reinf</h1>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        Gerador de Arquivo EFD-Reinf
                    </CardTitle>
                    <CardDescription>Selecione o período de competência para gerar o arquivo XML para transmissão ao SPED.</CardDescription>
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
                    </div>
                </CardContent>
                 <CardFooter className="flex-col items-start gap-4">
                     <Button onClick={handleGenerateFile} className="w-full md:w-auto" disabled={isGenerating || !activeCompany}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        {isGenerating ? 'Gerando...' : 'Gerar Arquivo XML'}
                    </Button>
                    <p className="text-xs text-muted-foreground">O arquivo será gerado com os eventos R-1000, R-2010 (serviços tomados com retenção de INSS) e R-2099 (fechamento).</p>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Arquivos Gerados</CardTitle>
                    <CardDescription>Visualize os arquivos EFD-Reinf gerados anteriormente.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingFiles ? (
                         <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : generatedFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="p-4 bg-muted rounded-full mb-4">
                                <FileText className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-semibold">Nenhum arquivo no histórico</h3>
                            <p className="text-muted-foreground mt-2">Os arquivos que você gerar aparecerão aqui.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Competência</TableHead>
                                    <TableHead>Evento Principal</TableHead>
                                    <TableHead>Data de Geração</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {generatedFiles.map(file => (
                                    <TableRow key={file.id}>
                                        <TableCell className="font-mono">{file.period}</TableCell>
                                        <TableCell>{file.type}</TableCell>
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
