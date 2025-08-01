
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, FileDigit, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Company } from '@/types/company';
import { generateEfdContribuicoesTxt } from "@/services/efd-contribuicoes-service";
import { Checkbox } from "@/components/ui/checkbox";
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from "next/link";

export default function EfdContribuicoesPage() {
    const [period, setPeriod] = useState<string>('');
    const [semMovimento, setSemMovimento] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [closedPeriods, setClosedPeriods] = useState<string[]>([]);
    const [loadingClosures, setLoadingClosures] = useState(true);

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
            setClosedPeriods([]);
            return;
        }

        setLoadingClosures(true);
        const closuresRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/fiscalClosures`);
        const unsubscribe = onSnapshot(closuresRef, (snapshot) => {
            const periods = snapshot.docs.map(doc => doc.id); // doc.id is 'YYYY-MM'
            setClosedPeriods(periods);
            setLoadingClosures(false);
        }, (error) => {
            console.error("Error fetching closures: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar períodos fechados" });
            setLoadingClosures(false);
        });

        return () => unsubscribe();
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
            const result = await generateEfdContribuicoesTxt(user.uid, activeCompany, period, semMovimento);
             if (!result.success) {
                toast({
                    variant: "destructive",
                    title: "Não foi possível gerar o arquivo",
                    description: result.message,
                });
            }
        } catch (error) {
            console.error("Erro ao gerar arquivo EFD:", error);
            toast({ variant: 'destructive', title: 'Erro ao gerar arquivo', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const formattedPeriodId = period.split('/').reverse().join('-');
    const isPeriodClosed = closedPeriods.includes(formattedPeriodId);
    const isButtonDisabled = isGenerating || !activeCompany || loadingClosures || (!isPeriodClosed && !semMovimento);


    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">EFD Contribuições</h1>

            <Card className="max-w-xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileDigit className="h-6 w-6 text-primary" />
                        Gerador de Arquivo EFD Contribuições
                    </CardTitle>
                    <CardDescription>Selecione o período de competência para gerar o arquivo TXT para importação no programa da Receita Federal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                     <div className="flex items-center space-x-2">
                        <Checkbox id="sem-movimento" checked={semMovimento} onCheckedChange={(checked) => setSemMovimento(Boolean(checked))} />
                        <label
                            htmlFor="sem-movimento"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Gerar arquivo sem movimento
                        </label>
                    </div>
                    <Button onClick={handleGenerateFile} className="w-full" disabled={isButtonDisabled}>
                        {isGenerating || loadingClosures ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        Gerar Arquivo TXT
                    </Button>
                     {!isPeriodClosed && !semMovimento && (
                        <p className="text-xs text-center text-destructive">
                            O período <span className="font-bold">{period}</span> precisa ser fechado no <Link href="/fiscal/apuracao" className="underline hover:text-destructive/80">módulo de Apuração</Link> antes de gerar o arquivo.
                        </p>
                    )}
                </CardContent>
                 <CardFooter>
                    <p className="text-xs text-muted-foreground">O arquivo gerado conterá os blocos 0, A, C e M, com base nas notas fiscais de saída e serviços lançadas no sistema. Se "sem movimento" for selecionado, os blocos serão gerados vazios.</p>
                </CardFooter>
            </Card>
        </div>
    );
}
