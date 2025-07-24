
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, ArrowLeft, Calendar as CalendarIcon, PieChart, Scale, FileBarChart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import Link from 'next/link';
import type { Company } from '@/types/company';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { generateTrialBalancePdf } from "@/services/trial-balance-report-service";

type ReportType = 'balancete' | 'dre' | 'balanco';

export default function RelatoriosContabeisPage() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: new Date(),
    });
    const [isGenerating, setIsGenerating] = useState<ReportType | null>(null);
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

    const handleGenerateReport = async (reportType: ReportType) => {
        if (!user || !activeCompany) {
            toast({ variant: 'destructive', title: 'Usuário ou empresa não identificados.' });
            return;
        }

        if (!dateRange || !dateRange.from || !dateRange.to) {
            toast({ variant: 'destructive', title: 'Período inválido', description: 'Por favor, selecione um período de início e fim.' });
            return;
        }

        setIsGenerating(reportType);
        
        try {
            switch(reportType) {
                case 'balancete':
                    const success = await generateTrialBalancePdf(user.uid, activeCompany, dateRange);
                    if (!success) {
                        toast({ title: "Nenhum dado encontrado", description: "Não há lançamentos no período selecionado para gerar o balancete." });
                    }
                    break;
                case 'dre':
                case 'balanco':
                     await new Promise(resolve => setTimeout(resolve, 1500));
                     toast({
                        title: 'Funcionalidade em Desenvolvimento',
                        description: `A geração do relatório ${reportType.toUpperCase()} ainda não foi implementada.`
                    });
                    break;
            }
        } catch (error) {
            console.error(`Erro ao gerar ${reportType}:`, error);
            toast({ variant: 'destructive', title: 'Erro ao gerar relatório', description: (error as Error).message });
        } finally {
            setIsGenerating(null);
        }
    };
    
    const setDatePreset = (preset: 'currentMonth' | 'lastMonth') => {
        const now = new Date();
        if (preset === 'currentMonth') {
            setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        } else if (preset === 'lastMonth') {
            const lastMonth = subMonths(now, 1);
            setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        }
    };


    const reportCards = [
        {
            type: 'balancete' as ReportType,
            title: 'Balancete de Verificação',
            description: 'Analisa o saldo de todas as contas contábeis (débitos e créditos) em um determinado período.',
            icon: Scale,
        },
        {
            type: 'dre' as ReportType,
            title: 'Demonstração de Resultado (DRE)',
            description: 'Mostra o confronto entre receitas, custos e despesas, apurando o lucro ou prejuízo da empresa.',
            icon: FileBarChart,
        },
        {
            type: 'balanco' as ReportType,
            title: 'Balanço Patrimonial',
            description: 'Demonstra a posição patrimonial e financeira da empresa em uma data específica.',
            icon: PieChart,
        },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/contabil">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Voltar</span>
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Relatórios Contábeis</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Gerar Relatórios</CardTitle>
                    <CardDescription>Selecione o período de apuração e o relatório desejado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Período de Apuração</label>
                         <div className="flex flex-wrap items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal md:w-[300px]",
                                            !dateRange && "text-muted-foreground"
                                        )}
                                        disabled={!activeCompany}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                                                {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                                                </>
                                            ) : (
                                                format(dateRange.from, "dd/MM/yy", { locale: ptBR })
                                            )
                                        ) : (
                                            <span>Selecione um período</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={setDateRange}
                                        numberOfMonths={2}
                                        locale={ptBR}
                                    />
                                </PopoverContent>
                            </Popover>
                            <Button variant="ghost" onClick={() => setDatePreset('currentMonth')}>Mês Atual</Button>
                            <Button variant="ghost" onClick={() => setDatePreset('lastMonth')}>Mês Anterior</Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {reportCards.map((report) => (
                             <Card key={report.type} className="flex flex-col md:flex-row items-start justify-between p-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-primary/10 rounded-md mt-1">
                                        <report.icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{report.title}</h3>
                                        <p className="text-sm text-muted-foreground max-w-xl">{report.description}</p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleGenerateReport(report.type)}
                                    className="w-full mt-4 md:w-auto md:mt-0"
                                    disabled={isGenerating !== null || !activeCompany}
                                >
                                    {isGenerating === report.type ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <FileText className="mr-2 h-4 w-4" />
                                    )}
                                    Gerar Relatório
                                </Button>
                            </Card>
                        ))}
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
