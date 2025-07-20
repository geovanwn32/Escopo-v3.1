
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Percent, FileText, Loader2, BarChart, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Company } from '@/types/company';
import { generatePgdasReportPdf, type PGDASResult } from "@/services/pgdas-report-service";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function PGDASPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [period, setPeriod] = useState(() => {
        const now = new Date();
        const month = String(now.getMonth()).padStart(2, '0'); // Mês anterior
        const year = now.getFullYear();
        if (now.getMonth() === 0) {
            return `12/${year - 1}`;
        }
        return `${month}/${year}`;
    });
    const [isCalculating, setIsCalculating] = useState(false);
    const [calculationResult, setCalculationResult] = useState<PGDASResult | null>(null);

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

    const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, ''); 
        if (value.length > 2) {
            value = `${value.slice(0, 2)}/${value.slice(2, 6)}`;
        }
        setPeriod(value);
        setCalculationResult(null); // Reset result when period changes
    };

    const handleCalculate = async () => {
        const periodRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
        if (!periodRegex.test(period)) {
            toast({ variant: 'destructive', title: "Período Inválido" });
            return;
        }

        if(!activeCompany || !user) {
             toast({ variant: 'destructive', title: "Selecione uma empresa!" });
             return;
        }

        setIsCalculating(true);
        
        try {
            const [monthStr, yearStr] = period.split('/');
            const month = parseInt(monthStr, 10);
            const year = parseInt(yearStr, 10);
            
            // Fetch launches for the current period (RPA)
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);

            const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/launches`);
            const q = query(launchesRef, where('date', '>=', Timestamp.fromDate(startDate)), where('date', '<=', Timestamp.fromDate(endDate)));
            const snapshot = await getDocs(q);

            const rpa = snapshot.docs.reduce((acc, doc) => {
                const launch = doc.data();
                if(launch.type === 'saida' || launch.type === 'servico') {
                    return acc + (launch.valorTotalNota || launch.valorLiquido || 0);
                }
                return acc;
            }, 0);
            
            // Simulate RBT12 for example purposes
            const rbt12 = rpa * 11 + Math.random() * 50000;

            if (rbt12 === 0) {
                 toast({ title: "Nenhum faturamento encontrado", description: "Não há notas de saída ou serviço no período selecionado." });
                 setCalculationResult(null);
                 return;
            }

            // Simplified calculation logic based on the example
            const aliquotaNominal = 0.135; // 13.50%
            const parcelaDeduzir = 17640.00;
            const aliquotaEfetiva = ((rbt12 * aliquotaNominal) - parcelaDeduzir) / rbt12;
            const taxAmount = rpa * aliquotaEfetiva;
            
            const result: PGDASResult = {
                rpa,
                rbt12,
                aliquotaNominal: aliquotaNominal * 100,
                parcelaDeduzir,
                aliquotaEfetiva: aliquotaEfetiva * 100,
                taxAmount,
            };

            setCalculationResult(result);
            toast({ title: "Cálculo do Simples Nacional concluído!" });

        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Erro ao buscar faturamento', description: 'Verifique o console para mais detalhes.'});
        } finally {
            setIsCalculating(false);
        }
    };
    
    const handleGenerateReport = () => {
        if (!activeCompany || !calculationResult) {
            toast({ variant: 'destructive', title: "Calcule o imposto primeiro."});
            return;
        }
        generatePgdasReportPdf(activeCompany, period, calculationResult);
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">PGDAS - Cálculo do Simples Nacional</h1>
            
            <Card>
                <CardHeader>
                    <CardTitle>Apuração do Período</CardTitle>
                    <CardDescription>Selecione a competência para apurar o imposto com base nas notas fiscais de saída e de serviço lançadas no sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row items-end gap-4 p-4 mb-4 border rounded-lg bg-muted/50">
                        <div className="grid w-full max-w-xs items-center gap-1.5">
                            <Label htmlFor="period">Competência</Label>
                            <Input 
                                id="period" 
                                placeholder="MM/AAAA" 
                                value={period} 
                                onChange={handlePeriodChange}
                                maxLength={7}
                            />
                        </div>
                        <Button onClick={handleCalculate} disabled={isCalculating || !activeCompany}>
                            {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                            Calcular Simples Nacional
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Resultado da Apuração</CardTitle>
                    <CardDescription>Visualize o resultado do cálculo para a competência de {period}.</CardDescription>
                </CardHeader>
                 <CardContent>
                     {!calculationResult ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="p-4 bg-muted rounded-full mb-4">
                                <Percent className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-semibold">Aguardando cálculo</h3>
                            <p className="text-muted-foreground mt-2">Insira a competência e clique em "Calcular Simples Nacional" para começar.</p>
                        </div>
                     ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="p-4 border rounded-lg flex items-center gap-4">
                                    <div className="p-3 bg-blue-100 rounded-full">
                                        <Wallet className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Faturamento do Período</p>
                                        <p className="text-xl font-bold">{formatCurrency(calculationResult.rpa)}</p>
                                    </div>
                                </div>
                                <div className="p-4 border rounded-lg flex items-center gap-4">
                                    <div className="p-3 bg-yellow-100 rounded-full">
                                        <Percent className="h-6 w-6 text-yellow-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Alíquota Efetiva</p>
                                        <p className="text-xl font-bold">{calculationResult.aliquotaEfetiva.toFixed(2)}%</p>
                                    </div>
                                </div>
                                 <div className="p-4 border rounded-lg flex items-center gap-4 bg-primary/5">
                                    <div className="p-3 bg-green-100 rounded-full">
                                        <BarChart className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Valor do Imposto (DAS)</p>
                                        <p className="text-xl font-bold text-primary">{formatCurrency(calculationResult.taxAmount)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4 border-t">
                                <Button onClick={handleGenerateReport}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Gerar Relatório Detalhado
                                </Button>
                            </div>
                        </div>
                     )}
                 </CardContent>
            </Card>
        </div>
    );
}
