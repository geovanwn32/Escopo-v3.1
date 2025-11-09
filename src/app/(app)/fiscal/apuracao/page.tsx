
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, ArrowLeft, BarChart2, Calculator, Scale, Lock, RefreshCcw, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import Link from 'next/link';
import type { Company } from '@/types/company';
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Launch } from '@/app/(app)/fiscal/page';
import type { Payroll } from '@/types/payroll';
import type { RCI } from '@/types/rci';
import { FiscalClosingModal } from "@/components/fiscal/fiscal-closing-modal";
import { ReopenPeriodModal } from "@/components/fiscal/reopen-period-modal";

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface TaxResult {
    pis: number;
    cofins: number;
    iss: number;
    inss: number;
    irrf: number;
    irpj: number;
    csll: number;
    total: number;
}

export default function ApuracaoPage() {
    const [period, setPeriod] = useState<string>('');
    const [isCalculating, setIsCalculating] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [calculationResult, setCalculationResult] = useState<TaxResult | null>(null);
    const [isClosingModalOpen, setClosingModalOpen] = useState(false);
    const [isReopenModalOpen, setReopenModalOpen] = useState(false);

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
        setCalculationResult(null);
    };

    const handleCalculate = async () => {
        if (!user || !activeCompany) {
            toast({ variant: 'destructive', title: 'Usuário, empresa ou conexão com banco de dados não identificados.' });
            return;
        }

        const periodRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
        if (!periodRegex.test(period)) {
            toast({ variant: 'destructive', title: 'Período inválido', description: 'Por favor, insira um período no formato MM/AAAA.' });
            return;
        }

        setIsCalculating(true);
        try {
            const [monthStr, yearStr] = period.split('/');
            const month = parseInt(monthStr, 10);
            const year = parseInt(yearStr, 10);

            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);

            // Fetch fiscal launches
            const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/launches`);
            const launchesQuery = query(launchesRef, 
                where('date', '>=', Timestamp.fromDate(startDate)),
                where('date', '<=', Timestamp.fromDate(endDate)),
                orderBy('date', 'desc')
            );
            const launchesSnap = await getDocs(launchesQuery);
            const launches = launchesSnap.docs.map(doc => doc.data() as Launch);
            
            // Fetch payrolls
            const payrollsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/payrolls`);
            const payrollsQuery = query(payrollsRef, where('period', '==', period));
            const payrollsSnap = await getDocs(payrollsQuery);
            const payrolls = payrollsSnap.docs.map(doc => doc.data() as Payroll);

            // Fetch RCIs
            const rcisRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/rcis`);
            const rcisQuery = query(rcisRef, where('period', '==', period));
            const rcisSnap = await getDocs(rcisQuery);
            const rcis = rcisSnap.docs.map(doc => doc.data() as RCI);

            if (launches.length === 0 && payrolls.length === 0 && rcis.length === 0) {
                 toast({ title: "Nenhum dado encontrado", description: "Não há lançamentos fiscais ou de pessoal no período para apurar." });
                 setCalculationResult(null);
                 return;
            }

            const pis = launches.reduce((acc, l) => acc + (l.valorPis || 0), 0);
            const cofins = launches.reduce((acc, l) => acc + (l.valorCofins || 0), 0);
            const csll = launches.reduce((acc, l) => acc + (l.valorCsll || 0), 0);
            const ir = launches.reduce((acc, l) => acc + (l.valorIr || 0), 0);
            const inss = launches.reduce((acc, l) => acc + (l.valorInss || 0), 0);

            let totalInssPessoal = 0;
            let totalIrrfPessoal = 0;
            
            payrolls.forEach(p => {
                p.events.forEach(e => {
                    if (e.rubrica.id === 'inss') totalInssPessoal += e.desconto;
                    if (e.rubrica.id === 'irrf') totalIrrfPessoal += e.desconto;
                });
            });

            rcis.forEach(r => {
                 r.events.forEach(e => {
                    if (e.rubrica.id === 'inss') totalInssPessoal += e.desconto;
                    if (e.rubrica.id === 'irrf') totalIrrfPessoal += e.desconto;
                });
            });
            
            const totalInssCombined = inss + totalInssPessoal;
            const totalIrrfCombined = ir + totalIrrfPessoal;

            const result: TaxResult = {
                pis, cofins, csll, irpj: ir, iss: 0, // ISS needs aliquota and is more complex
                inss: totalInssCombined, irrf: totalIrrfCombined,
                total: pis + cofins + csll + ir + totalInssCombined + totalIrrfCombined
            };

            setCalculationResult(result);
            toast({ title: 'Apuração concluída!', description: 'Os impostos do período foram calculados.' });
        } catch (error) {
            console.error("Erro ao apurar impostos:", error);
            toast({ variant: 'destructive', title: 'Erro na Apuração', description: (error as Error).message });
        } finally {
            setIsCalculating(false);
        }
    };
    
    const handleZeroCalculation = () => {
        const zeroResult: TaxResult = {
            pis: 0, cofins: 0, csll: 0, irpj: 0, iss: 0, inss: 0, irrf: 0, total: 0
        };
        setCalculationResult(zeroResult);
        toast({ title: 'Apuração Zerada', description: `Apurado R$ 0,00 para o período ${period}.` });
    };


    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/fiscal">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="sr-only">Voltar</span>
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">Apuração de Impostos</h1>
                </div>
                 <div className="flex items-center gap-2">
                    <Button variant="destructive" onClick={() => setReopenModalOpen(true)} disabled={!activeCompany}>
                      <KeyRound className="mr-2 h-4 w-4"/>
                      Reabrir Período
                    </Button>
                    <Button onClick={() => setClosingModalOpen(true)} disabled={!activeCompany}>
                      <Lock className="mr-2 h-4 w-4"/>
                      Realizar Fechamento Fiscal
                    </Button>
                </div>
            </div>

            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>Apuração do Período</CardTitle>
                    <CardDescription>Selecione o período de competência para consolidar os impostos e contribuições dos módulos fiscal e pessoal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex flex-col sm:flex-row items-end gap-4 p-4 mb-4 border rounded-lg bg-muted/50">
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
                         <Button onClick={handleCalculate} className="w-full sm:w-auto" disabled={isCalculating || !activeCompany}>
                            {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                            Apurar Impostos
                        </Button>
                        <Button onClick={handleZeroCalculation} variant="outline" className="w-full sm:w-auto" disabled={isCalculating || !activeCompany}>
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Apurar Zerado
                        </Button>
                    </div>

                    {calculationResult && (
                        <div className="pt-4">
                             <h3 className="text-lg font-semibold mb-4 text-center">Resultado da Apuração para {period}</h3>
                             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                <StatCard title="PIS" value={formatCurrency(calculationResult.pis)} />
                                <StatCard title="COFINS" value={formatCurrency(calculationResult.cofins)} />
                                <StatCard title="CSLL" value={formatCurrency(calculationResult.csll)} />
                                <StatCard title="IRPJ" value={formatCurrency(calculationResult.irpj)} />
                                <StatCard title="INSS" value={formatCurrency(calculationResult.inss)} />
                                <StatCard title="IRRF" value={formatCurrency(calculationResult.irrf)} />
                             </div>
                             <div className="mt-6 p-4 rounded-lg bg-primary/10 flex justify-between items-center">
                                <h4 className="text-xl font-bold text-primary">Total de Impostos</h4>
                                <p className="text-2xl font-extrabold text-primary">{formatCurrency(calculationResult.total)}</p>
                             </div>
                        </div>
                    )}
                </CardContent>
            </Card>
             {user && activeCompany && (
                <FiscalClosingModal
                    isOpen={isClosingModalOpen}
                    onClose={() => setClosingModalOpen(false)}
                    userId={user.uid}
                    companyId={activeCompany.id}
                />
            )}
             {user && activeCompany && (
                <ReopenPeriodModal
                    isOpen={isReopenModalOpen}
                    onClose={() => setReopenModalOpen(false)}
                    userId={user.uid}
                    companyId={activeCompany.id}
                />
            )}
        </div>
    );
}


function StatCard({ title, value }: { title: string, value: string }) {
    return (
        <Card className="text-center">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{value}</p>
            </CardContent>
        </Card>
    )
}

    