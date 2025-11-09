"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import Link from 'next/link';
import type { Company } from '@/types/company';
import { generateSalesReportPdf } from "@/services/sales-report-service";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";


export default function VendasReportPage() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: new Date(),
    });
    const [isGenerating, setIsGenerating] = useState(false);
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

    const handleGenerateReport = async () => {
        if (!user || !activeCompany) {
            toast({ variant: 'destructive', title: 'Usuário ou empresa não identificados.' });
            return;
        }

        if (!dateRange || !dateRange.from || !dateRange.to) {
            toast({ variant: 'destructive', title: 'Período inválido', description: 'Por favor, selecione um período de início e fim.' });
            return;
        }

        setIsGenerating(true);
        try {
            await generateSalesReportPdf(user.uid, activeCompany, dateRange);
        } catch (error) {
            console.error("Erro ao gerar relatório de vendas:", error);
            toast({ variant: 'destructive', title: 'Erro ao gerar relatório', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const setDatePreset = (preset: 'currentMonth' | 'lastMonth' | 'currentYear') => {
        const now = new Date();
        if (preset === 'currentMonth') {
            setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        } else if (preset === 'lastMonth') {
            const lastMonth = subMonths(now, 1);
            setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        } else if (preset === 'currentYear') {
            setDateRange({ from: startOfYear(now), to: endOfYear(now) });
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
                <h1 className="text-2xl font-bold">Relatório de Vendas</h1>
            </div>

            <Card className="max-w-xl mx-auto">
                <CardHeader>
                    <CardTitle>Gerar Relatório de Vendas</CardTitle>
                    <CardDescription>Selecione o período para gerar o relatório com todas as notas de saída (vendas e serviços).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid gap-2">
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                         <div className="flex flex-wrap items-center gap-2">
                            <Button variant="ghost" onClick={() => setDatePreset('currentMonth')}>Este Mês</Button>
                            <Button variant="ghost" onClick={() => setDatePreset('lastMonth')}>Mês Anterior</Button>
                             <Button variant="ghost" onClick={() => setDatePreset('currentYear')}>Este Ano</Button>
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
