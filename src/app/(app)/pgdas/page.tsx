
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Percent, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Company } from '@/types/company';

export default function PGDASPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [period, setPeriod] = useState(() => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        return `${month}/${year}`;
    });
    const [isCalculating, setIsCalculating] = useState(false);

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
    };

    const handleCalculate = async () => {
        const periodRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
        if (!periodRegex.test(period)) {
            toast({
                variant: 'destructive',
                title: "Período Inválido",
                description: "Por favor, insira a competência no formato MM/AAAA.",
            });
            return;
        }

        if(!activeCompany) {
             toast({ variant: 'destructive', title: "Selecione uma empresa!" });
             return;
        }

        setIsCalculating(true);
        // Simulate calculation
        await new Promise(resolve => setTimeout(resolve, 2000));
        toast({ title: "Cálculo do Simples Nacional em desenvolvimento" });
        setIsCalculating(false);
    };

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
                     <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="p-4 bg-muted rounded-full mb-4">
                            <Percent className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold">Aguardando cálculo</h3>
                        <p className="text-muted-foreground mt-2">Insira a competência e clique em "Calcular Simples Nacional" para começar.</p>
                    </div>
                 </CardContent>
            </Card>
        </div>
    );
}
