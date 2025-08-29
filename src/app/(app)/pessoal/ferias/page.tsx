
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search,
  Save,
  Calculator,
  Loader2,
  ArrowLeft,
  Printer,
  FileText,
  User,
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
import { EmployeeSelectionModal } from '@/components/pessoal/employee-selection-modal';
import { calculateVacation, VacationResult } from '@/services/vacation-service';
import { collection, addDoc, doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Vacation } from '@/types/vacation';
import Link from 'next/link';
import { DateInput } from '@/components/ui/date-input';
import { generateVacationNoticePdf } from '@/services/vacation-notice-service';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function VacationPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const vacationId = searchParams.get('id');

    const [events, setEvents] = useState<VacationResult['events']>([]);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isLoading, setIsLoading] = useState(!!vacationId);
    const [isSaving, setIsSaving] = useState(false);
    const [currentVacationId, setCurrentVacationId] = useState<string | null>(vacationId);
    
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [vacationDays, setVacationDays] = useState<number>(30);
    const [sellVacation, setSellVacation] = useState<boolean>(false);
    const [advanceThirteenth, setAdvanceThirteenth] = useState<boolean>(false);

    const [calculationResult, setCalculationResult] = useState<VacationResult | null>(null);

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

    useEffect(() => {
        const fetchVacation = async () => {
             if (!vacationId || !user || !activeCompany) {
                setIsLoading(false);
                return;
            };
            setIsLoading(true);
             try {
                const vacationRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/vacations`, vacationId);
                const vacationSnap = await getDoc(vacationRef);
                 if (vacationSnap.exists()) {
                    const data = vacationSnap.data() as Vacation;
                    
                    const empRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/employees`, data.employeeId);
                    const empSnap = await getDoc(empRef);
                    if (empSnap.exists()) {
                         const employeeData = {
                            id: empSnap.id,
                            ...empSnap.data(),
                            dataAdmissao: (empSnap.data().dataAdmissao as Timestamp).toDate(),
                            dataNascimento: (empSnap.data().dataNascimento as Timestamp).toDate(),
                        } as Employee;
                        setSelectedEmployee(employeeData);
                    }
                    
                    setStartDate((data.startDate as Timestamp).toDate());
                    setVacationDays(data.vacationDays);
                    setSellVacation(data.sellVacation);
                    setAdvanceThirteenth(data.advanceThirteenth);
                    setCurrentVacationId(vacationSnap.id);
                    setCalculationResult(data.result);
                    setEvents(data.result.events);

                } else {
                    toast({ variant: 'destructive', title: 'Férias não encontradas.' });
                    router.push('/pessoal/ferias');
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro ao carregar férias.' });
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        if (vacationId && user && activeCompany) {
            fetchVacation();
        } else {
            setIsLoading(false);
        }
    }, [vacationId, user, activeCompany, toast, router]);
    
    const handleSelectEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsEmployeeModalOpen(false);
        setEvents([]);
        setCalculationResult(null);
    };

    const handleCalculate = async () => {
        if (!selectedEmployee || !startDate || !vacationDays) {
            toast({
                variant: 'destructive',
                title: 'Dados incompletos',
                description: 'Por favor, preencha todos os campos para calcular as férias.'
            });
            return;
        }

        setIsCalculating(true);
        try {
           const result = calculateVacation({
               employee: selectedEmployee,
               startDate,
               vacationDays,
               sellVacation,
               advanceThirteenth
           });
           setCalculationResult(result);
           setEvents(result.events);

           toast({
                title: 'Cálculo Realizado!',
                description: 'Os valores das férias foram calculados.'
            });
            await handleSave();

        } catch (error) {
            console.error("Erro no cálculo de férias:", error);
            toast({
                variant: 'destructive',
                title: 'Erro no cálculo',
                description: (error as Error).message,
            })
        } finally {
            setIsCalculating(false);
        }
    };
        
    const { totalProventos, totalDescontos, liquido } = useMemo(() => {
        if (!calculationResult) return { totalProventos: 0, totalDescontos: 0, liquido: 0 };
        return {
            totalProventos: calculationResult.totalProventos,
            totalDescontos: calculationResult.totalDescontos,
            liquido: calculationResult.liquido
        }
    }, [calculationResult]);
    
    const formatNumberForDisplay = (num?: number) => {
        if (num === undefined || num === null) return '0,00';
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const handleSave = async () => {
        if (!user || !activeCompany || !selectedEmployee || !calculationResult) {
            toast({ variant: 'destructive', title: 'Dados incompletos', description: 'Calcule as férias antes de salvar.' });
            return;
        }

        setIsSaving(true);
        
        const vacationData: Omit<Vacation, 'id' | 'createdAt'> = {
            employeeId: selectedEmployee.id!,
            employeeName: selectedEmployee.nomeCompleto,
            startDate: startDate!,
            vacationDays,
            sellVacation,
            advanceThirteenth,
            result: calculationResult,
            updatedAt: serverTimestamp(),
        };

        try {
            if (currentVacationId) {
                const vacationRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/vacations`, currentVacationId);
                await setDoc(vacationRef, { ...vacationData, updatedAt: serverTimestamp() }, { merge: true });
                toast({ title: `Cálculo de férias atualizado com sucesso!` });
            } else {
                const vacationsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/vacations`);
                const docRef = await addDoc(vacationsRef, { ...vacationData, createdAt: serverTimestamp() });
                setCurrentVacationId(docRef.id);
                router.replace(`/pessoal/ferias?id=${docRef.id}`, { scroll: false });
                toast({ title: `Cálculo de férias salvo com sucesso!` });
            }
        } catch (error) {
            console.error("Erro ao salvar férias:", error);
            toast({ variant: 'destructive', title: 'Erro ao salvar férias' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneratePdf = () => {
        if (!activeCompany || !selectedEmployee || !calculationResult || !startDate) {
            toast({ variant: 'destructive', title: 'Dados incompletos para gerar PDF.' });
            return;
        }

        const vacationData: Vacation = {
            id: currentVacationId || undefined,
            employeeId: selectedEmployee.id!,
            employeeName: selectedEmployee.nomeCompleto,
            startDate: startDate!,
            vacationDays,
            sellVacation,
            advanceThirteenth,
            result: calculationResult,
        };
        generateVacationNoticePdf(activeCompany, selectedEmployee, vacationData);
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }


    return (
        <div className="space-y-4">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/pessoal">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="sr-only">Voltar</span>
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">Cálculo de Férias</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={isSaving || !calculationResult}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                        Salvar Cálculo
                    </Button>
                    <Button onClick={handleCalculate} disabled={isCalculating || !selectedEmployee}>
                        {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Calculator className="mr-2 h-4 w-4"/>}
                        Calcular Férias
                    </Button>
                     <Button variant="secondary" onClick={handleGeneratePdf} disabled={!calculationResult}>
                        <Printer className="mr-2 h-4 w-4" />
                        Visualizar Aviso
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                        <h3 className="text-lg font-semibold">Parâmetros das Férias</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1 lg:col-span-2">
                                <Label>Empregado</Label>
                                <div className="relative">
                                    <Input
                                        placeholder="Selecione um funcionário"
                                        className="pr-10"
                                        readOnly
                                        value={selectedEmployee ? selectedEmployee.nomeCompleto : ''}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                        onClick={() => setIsEmployeeModalOpen(true)}
                                        disabled={!activeCompany}
                                        title={"Selecionar funcionário"}
                                    >
                                        <Search className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label>Data de Início das Férias</Label>
                                <DateInput value={startDate} onChange={setStartDate} />
                            </div>
                            <div className="space-y-1">
                                <Label>Dias de Férias</Label>
                                <Input 
                                    type="number"
                                    value={vacationDays}
                                    onChange={(e) => setVacationDays(Number(e.target.value))}
                                    max={30}
                                    min={5}
                                />
                            </div>
                        </div>
                        <div className="flex items-center space-x-6 pt-2">
                            <div className="flex items-center space-x-2">
                                <Switch id="sell-vacation" checked={sellVacation} onCheckedChange={setSellVacation} />
                                <Label htmlFor="sell-vacation">Vender 1/3 das Férias (Abono Pecuniário)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="advance-thirteenth" checked={advanceThirteenth} onCheckedChange={setAdvanceThirteenth} />
                                <Label htmlFor="advance-thirteenth">Adiantar 1ª Parcela do 13º</Label>
                            </div>
                        </div>
                    </div>


                    <div className="border rounded-md mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead>Referência</TableHead>
                                    <TableHead className="text-right">Provento</TableHead>
                                    <TableHead className="text-right">Desconto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!selectedEmployee ? (
                                    <TableRow>
                                        <TableCell colSpan={4}>
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="p-4 bg-muted rounded-full mb-4">
                                                    <User className="h-10 w-10 text-muted-foreground" />
                                                </div>
                                                <h3 className="text-xl font-semibold">Selecione um funcionário</h3>
                                                <p className="text-muted-foreground mt-2">Escolha um funcionário para iniciar o cálculo das férias.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : events.length === 0 ? (
                                     <TableRow>
                                        <TableCell colSpan={4}>
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="p-4 bg-muted rounded-full mb-4">
                                                    <Calculator className="h-10 w-10 text-muted-foreground" />
                                                </div>
                                                <h3 className="text-xl font-semibold">Aguardando Cálculo</h3>
                                                <p className="text-muted-foreground mt-2">Preencha os parâmetros e clique em "Calcular Férias".</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : events.map((event, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{event.descricao}</TableCell>
                                        <TableCell>{event.referencia}</TableCell>
                                        <TableCell className="text-right font-mono">{formatNumberForDisplay(event.provento)}</TableCell>
                                        <TableCell className="text-right font-mono text-red-600">{formatNumberForDisplay(event.desconto)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex justify-end items-center mt-4">
                        <div className="flex gap-6 text-right">
                           <div className="space-y-1">
                             <p className="font-semibold text-lg text-green-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalProventos)}</p>
                           </div>
                            <div className="space-y-1">
                             <p className="font-semibold text-lg text-red-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDescontos)}</p>
                           </div>
                           <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Líquido a Receber:</p>
                                <p className="font-bold text-lg text-blue-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(liquido)}</p>
                           </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {user && activeCompany && (
                <EmployeeSelectionModal
                    isOpen={isEmployeeModalOpen}
                    onClose={() => setIsEmployeeModalOpen(false)}
                    onSelect={handleSelectEmployee}
                    userId={user.uid}
                    companyId={activeCompany.id}
                />
            )}
        </div>
    );
}
