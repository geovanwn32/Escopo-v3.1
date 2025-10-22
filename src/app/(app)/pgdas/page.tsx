
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Percent, FileText, Loader2, BarChart, Wallet, Save, Eye, MoreHorizontal, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Company } from '@/types/company';
import { generatePgdasReportPdf, type PGDASResult } from "@/services/pgdas-report-service";
import { collection, getDocs, query, where, Timestamp, addDoc, onSnapshot, orderBy, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Pgdas, SimplesAnnexType } from "@/types/pgdas";
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Launch } from "@/types";

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const simplesBrackets: Record<SimplesAnnexType, { limit: number; rate: number; deduction: number }[]> = {
    "anexo-i": [ // Comércio
        { limit: 180000, rate: 0.04, deduction: 0 },
        { limit: 360000, rate: 0.073, deduction: 5940 },
        { limit: 720000, rate: 0.095, deduction: 13860 },
        { limit: 1800000, rate: 0.107, deduction: 22500 },
        { limit: 3600000, rate: 0.143, deduction: 87300 },
        { limit: 4800000, rate: 0.19, deduction: 378000 },
    ],
    "anexo-ii": [ // Indústria
        { limit: 180000, rate: 0.045, deduction: 0 },
        { limit: 360000, rate: 0.078, deduction: 5940 },
        { limit: 720000, rate: 0.1, deduction: 13860 },
        { limit: 1800000, rate: 0.112, deduction: 22500 },
        { limit: 3600000, rate: 0.147, deduction: 85500 },
        { limit: 4800000, rate: 0.3, deduction: 720000 },
    ],
    "anexo-iii": [ // Serviços e Locação de Bens Móveis
        { limit: 180000, rate: 0.06, deduction: 0 },
        { limit: 360000, rate: 0.112, deduction: 9360 },
        { limit: 720000, rate: 0.135, deduction: 17640 },
        { limit: 1800000, rate: 0.16, deduction: 35640 },
        { limit: 3600000, rate: 0.21, deduction: 125640 },
        { limit: 4800000, rate: 0.33, deduction: 648000 },
    ],
    "anexo-iv": [ // Serviços (Limpeza, Obras, Vigilância, Advocatícios)
        { limit: 180000, rate: 0.045, deduction: 0 },
        { limit: 360000, rate: 0.09, deduction: 8100 },
        { limit: 720000, rate: 0.102, deduction: 12420 },
        { limit: 1800000, rate: 0.14, deduction: 39780 },
        { limit: 3600000, rate: 0.22, deduction: 183780 },
        { limit: 4800000, rate: 0.33, deduction: 828000 },
    ],
    "anexo-v": [ // Serviços (Auditoria, Tecnologia, Publicidade, Engenharia)
        { limit: 180000, rate: 0.155, deduction: 0 },
        { limit: 360000, rate: 0.18, deduction: 4500 },
        { limit: 720000, rate: 0.195, deduction: 9900 },
        { limit: 1800000, rate: 0.205, deduction: 17100 },
        { limit: 3600000, rate: 0.23, deduction: 62100 },
        { limit: 4800000, rate: 0.305, deduction: 540000 },
    ]
};


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
    const [annex, setAnnex] = useState<SimplesAnnexType>("anexo-i");
    const [isCalculating, setIsCalculating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [calculationResult, setCalculationResult] = useState<PGDASResult | null>(null);
    const [savedCalculations, setSavedCalculations] = useState<Pgdas[]>([]);
    const [loadingSaved, setLoadingSaved] = useState(true);

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

    useEffect(() => {
        if (!user || !activeCompany) {
            setLoadingSaved(false);
            setSavedCalculations([]);
            return;
        }

        setLoadingSaved(true);
        const pgdasRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/pgdas`);
        const q = query(pgdasRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const calcsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Pgdas));
            setSavedCalculations(calcsData);
            setLoadingSaved(false);
        }, (error) => {
            console.error("Erro ao buscar cálculos salvos: ", error);
            toast({ variant: 'destructive', title: "Erro ao buscar histórico de PGDAS." });
            setLoadingSaved(false);
        });

        return () => unsubscribe();
    }, [user, activeCompany, toast]);

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
        
        if (!annex || !simplesBrackets[annex]) {
             toast({ variant: 'destructive', title: "Anexo Inválido", description: "Selecione um anexo válido para o cálculo." });
             return;
        }

        setIsCalculating(true);
        
        try {
            const [monthStr, yearStr] = period.split('/');
            const month = parseInt(monthStr, 10);
            const year = parseInt(yearStr, 10);
            
            const currentPeriodDate = new Date(year, month - 1, 1);
            
            const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/launches`);
            
            const revenueTypes = (annex === 'anexo-i' || annex === 'anexo-ii') ? ['saida'] : ['servico'];

            // Function to fetch and calculate revenue for a given date range and types
            const getRevenue = async (startDate: Date, endDate: Date, types: string[]): Promise<number> => {
                const q = query(launchesRef, 
                    where('date', '>=', Timestamp.fromDate(startDate)), 
                    where('date', '<=', Timestamp.fromDate(endDate))
                );
                const snapshot = await getDocs(q);

                // Filter by type and status in memory
                const relevantLaunches = snapshot.docs
                    .map(doc => doc.data() as Launch)
                    .filter(launch => types.includes(launch.type) && launch.status === 'Normal');

                return relevantLaunches.reduce((acc, launch) => {
                    return acc + (launch.valorTotalNota || launch.valorLiquido || 0);
                }, 0);
            };

            // --- Calculate RPA (Receita do Período de Apuração) ---
            const rpaStartDate = startOfMonth(currentPeriodDate);
            const rpaEndDate = endOfMonth(currentPeriodDate);
            const rpa = await getRevenue(rpaStartDate, rpaEndDate, revenueTypes);

            // --- Calculate RBT12 (Receita Bruta dos últimos 12 meses) ---
            const rbt12EndDate = endOfMonth(subMonths(currentPeriodDate, 1));
            const rbt12StartDate = startOfMonth(subMonths(rbt12EndDate, 11));
            const rbt12 = await getRevenue(rbt12StartDate, rbt12EndDate, revenueTypes);

            if (rpa === 0) {
                 toast({ title: "Nenhum faturamento encontrado", description: "Não há notas fiscais correspondentes ao anexo selecionado neste período." });
                 setCalculationResult(null);
                 setIsCalculating(false);
                 return;
            }

            // Simples Nacional calculation logic based on selected annex
            const brackets = simplesBrackets[annex];
            let currentBracket = brackets[0];

            for (const bracket of brackets) {
                if(rbt12 <= bracket.limit) {
                    currentBracket = bracket;
                    break;
                }
                // Handle the last bracket
                currentBracket = bracket;
            }
            
            const aliquotaNominal = currentBracket.rate; 
            const parcelaDeduzir = currentBracket.deduction;
            const aliquotaEfetiva = rbt12 > 0 ? ((rbt12 * aliquotaNominal) - parcelaDeduzir) / rbt12 : aliquotaNominal;
            const taxAmount = rpa * aliquotaEfetiva;
            
            const result: PGDASResult = {
                rpa,
                rbt12,
                aliquotaNominal: aliquotaNominal * 100,
                parcelaDeduzir,
                aliquotaEfetiva: Math.max(0, aliquotaEfetiva * 100),
                taxAmount: Math.max(0, taxAmount),
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

     const handleSave = async () => {
        if (!user || !activeCompany || !calculationResult) {
            toast({ variant: "destructive", title: "Nenhum cálculo a ser salvo." });
            return;
        }

        setIsSaving(true);
        try {
            const pgdasData: Omit<Pgdas, 'id'> = {
                period,
                anexo: annex,
                result: calculationResult,
                createdAt: serverTimestamp(),
            };
            const pgdasRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/pgdas`);
            await addDoc(pgdasRef, pgdasData);

            toast({ title: "Cálculo salvo com sucesso!" });
        } catch (error) {
            console.error("Erro ao salvar cálculo:", error);
            toast({ variant: "destructive", title: "Erro ao salvar cálculo." });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleGenerateReport = (result: PGDASResult, reportPeriod: string, reportAnnex: SimplesAnnexType) => {
        if (!activeCompany) return;
        generatePgdasReportPdf(activeCompany, reportPeriod, result, reportAnnex);
    }
    
    const handleViewSaved = (savedCalc: Pgdas) => {
        setPeriod(savedCalc.period);
        setAnnex(savedCalc.anexo);
        setCalculationResult(savedCalc.result);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const handleDelete = async (calcId: string) => {
        if (!user || !activeCompany) return;
        try {
            const docRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/pgdas`, calcId);
            await deleteDoc(docRef);
            toast({ title: "Cálculo excluído com sucesso." });
        } catch (error) {
            console.error("Erro ao excluir cálculo:", error);
            toast({ variant: "destructive", title: "Erro ao excluir cálculo." });
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">PGDAS - Cálculo do Simples Nacional</h1>
            
            <Card>
                <CardHeader>
                    <CardTitle>Apuração do Período</CardTitle>
                    <CardDescription>Selecione a competência e o anexo para apurar o imposto com base nas notas fiscais lançadas.</CardDescription>
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
                         <div className="grid w-full max-w-xs items-center gap-1.5">
                            <Label htmlFor="annex">Anexo</Label>
                             <Select value={annex} onValueChange={(value) => setAnnex(value as SimplesAnnexType)}>
                                <SelectTrigger id="annex">
                                    <SelectValue placeholder="Selecione o anexo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="anexo-i">Anexo I - Comércio</SelectItem>
                                    <SelectItem value="anexo-ii">Anexo II - Indústria</SelectItem>
                                    <SelectItem value="anexo-iii">Anexo III - Serviços</SelectItem>
                                    <SelectItem value="anexo-iv">Anexo IV - Serviços</SelectItem>
                                    <SelectItem value="anexo-v">Anexo V - Serviços</SelectItem>
                                </SelectContent>
                            </Select>
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
                            <p className="text-muted-foreground mt-2">Insira a competência, selecione o anexo e clique em "Calcular" para começar.</p>
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
                            <div className="flex justify-end pt-4 border-t gap-2">
                                <Button variant="outline" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar Cálculo
                                </Button>
                                <Button onClick={() => handleGenerateReport(calculationResult, period, annex)}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Gerar Relatório Detalhado
                                </Button>
                            </div>
                        </div>
                     )}
                 </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Apurações</CardTitle>
                    <CardDescription>Visualize os cálculos salvos anteriormente.</CardDescription>
                </CardHeader>
                <CardContent>
                     {loadingSaved ? (
                         <div className="flex justify-center items-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                         </div>
                     ) : savedCalculations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="p-4 bg-muted rounded-full mb-4">
                                <FileText className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-semibold">Nenhum cálculo salvo</h3>
                            <p className="text-muted-foreground mt-2">Os cálculos salvos aparecerão aqui.</p>
                        </div>
                     ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Competência</TableHead>
                                    <TableHead>Anexo</TableHead>
                                    <TableHead>Faturamento</TableHead>
                                    <TableHead className="text-right">Valor do Imposto</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {savedCalculations.map((calc) => (
                                    <TableRow key={calc.id}>
                                        <TableCell className="font-mono">{calc.period}</TableCell>
                                        <TableCell>{calc.anexo.replace('anexo-', 'Anexo ').toUpperCase()}</TableCell>
                                        <TableCell>{formatCurrency(calc.result.rpa)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(calc.result.taxAmount)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Abrir menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleViewSaved(calc)}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Visualizar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleGenerateReport(calc.result, calc.period, calc.anexo)}>
                                                        <FileText className="mr-2 h-4 w-4" />
                                                        Baixar Relatório
                                                    </DropdownMenuItem>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                                  <Trash2 className="mr-2 h-4 w-4" />
                                                                  Excluir
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Esta ação não pode ser desfeita. O cálculo será permanentemente removido do histórico.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(calc.id!)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
