
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import Link from 'next/link';
import type { Company } from '@/types/company';
import { generatePayrollSummaryPdf } from "@/services/payroll-summary-service";

export default function ResumoFolhaPage() {
    const [period, setPeriod] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);

    const { user } = useAuth();
    const { toast } = useToast();
    
    useEffect(() => {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        setPeriod(`${currentMonth.toString().padStart(2, '0')}/${currentYear}`);

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

    const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, ''); 
        if (value.length > 2) {
            value = `${value.slice(0, 2)}/${value.slice(2, 6)}`;
        }
        setPeriod(value);
    };

    const handleGenerateReport = async () => {
        if (!user || !activeCompany) {
            toast({ variant: 'destructive', title: 'Usuário ou empresa não identificados.' });
            return;
        }

        const [monthStr, yearStr] = period.split('/');
        const month = parseInt(monthStr, 10);
        const year = parseInt(yearStr, 10);

        if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 2000) {
            toast({ variant: 'destructive', title: 'Período inválido', description: 'Por favor, insira um período no formato MM/AAAA.' });
            return;
        }

        setIsGenerating(true);
        try {
            await generatePayrollSummaryPdf(user.uid, activeCompany, { month, year });
        } catch (error) {
            console.error("Erro ao gerar resumo da folha:", error);
            toast({ variant: 'destructive', title: 'Erro ao gerar relatório', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/pessoal">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Voltar</span>
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Resumo da Folha</h1>
            </div>

            <Card className="max-w-xl mx-auto">
                <CardHeader>
                    <CardTitle>Gerar Relatório Consolidado</CardTitle>
                    <CardDescription>Selecione o período de competência para gerar o relatório com todos os lançamentos da folha de pagamento.</CardDescription>
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
                    <Button onClick={handleGenerateReport} className="w-full" disabled={isGenerating || !activeCompany}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        Gerar Relatório
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
