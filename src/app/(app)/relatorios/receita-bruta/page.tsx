
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
import { generateGrossRevenueReportPdf } from "@/services/gross-revenue-report-service";
import { DateInput } from "@/components/ui/date-input";

export default function ReceitaBrutaReportPage() {
    const [period, setPeriod] = useState<string>('');
    const [signatureDate, setSignatureDate] = useState<Date>(new Date());
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);

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

        const periodRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
        if (!periodRegex.test(period)) {
            toast({ variant: 'destructive', title: 'Período inválido', description: 'Por favor, insira um período no formato MM/AAAA.' });
            return;
        }

        if (!signatureDate) {
            toast({ variant: 'destructive', title: 'Data de assinatura inválida', description: 'Por favor, selecione uma data para a assinatura.' });
            return;
        }

        setIsGenerating(true);
        try {
            await generateGrossRevenueReportPdf(user.uid, activeCompany, period, signatureDate);
        } catch (error) {
            console.error("Erro ao gerar relatório de receita bruta:", error);
            toast({ variant: 'destructive', title: 'Erro ao gerar relatório', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/relatorios">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Voltar</span>
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Relatório Mensal de Receitas Brutas</h1>
            </div>

            <Card className="max-w-xl mx-auto">
                <CardHeader>
                    <CardTitle>Gerar Relatório</CardTitle>
                    <CardDescription>Selecione o período de competência para gerar o relatório consolidado de receitas.</CardDescription>
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
                            <Label htmlFor="signatureDate">Data de Assinatura</Label>
                            <DateInput 
                                value={signatureDate}
                                onChange={(date) => setSignatureDate(date || new Date())}
                            />
                        </div>
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
