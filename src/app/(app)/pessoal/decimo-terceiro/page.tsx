
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
  Gift,
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import type { Company } from '@/types/company';
import type { Employee } from '@/types/employee';
import { EmployeeSelectionModal } from '@/components/pessoal/employee-selection-modal';
import { calculateThirteenth, ThirteenthResult } from '@/services/thirteenth-salary-service';
import { collection, addDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Thirteenth } from '@/types/thirteenth';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateThirteenthReceiptPdf } from '@/services/thirteenth-receipt-service';

export default function ThirteenthPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const thirteenthId = searchParams.get('id');

    const [events, setEvents] = useState<ThirteenthResult['events']>([]);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isLoading, setIsLoading] = useState(!!thirteenthId);
    const [isSaving, setIsSaving] = useState(false);
    const [currentThirteenthId, setCurrentThirteenthId] = useState<string | null>(thirteenthId);
    
    // Form state
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [parcel, setParcel] = useState<'first' | 'second' | 'unique'>('first');

    const [calculationResult, setCalculationResult] = useState<ThirteenthResult | null>(null);

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
        const fetchThirteenth = async () => {
             if (!thirteenthId || !user || !activeCompany) {
                setIsLoading(false);
                return;
            };
            setIsLoading(true);
             try {
                const thirteenthRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/thirteenths`, thirteenthId);
                const thirteenthSnap = await getDoc(thirteenthRef);
                 if (thirteenthSnap.exists()) {
                    const data = thirteenthSnap.data() as Thirteenth;
                    
                    const empRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/employees`, data.employeeId);
                    const empSnap = await getDoc(empRef);
                    if (empSnap.exists()) {
                         const employeeData = {
                            id: empSnap.id,
                            ...empSnap.data(),
                            dataAdmissao: empSnap.data().dataAdmissao.toDate(),
                            dataNascimento: empSnap.data().dataNascimento.toDate(),
                        } as Employee;
                        setSelectedEmployee(employeeData);
                    }
                    
                    setYear(data.year);
                    setParcel(data.parcel);
                    setCurrentThirteenthId(thirteenthSnap.id);
                    setCalculationResult(data.result);
                    setEvents(data.result.events);

                } else {
                    toast({ variant: 'destructive', title: 'Cálculo de 13º não encontrado.' });
                    router.push('/pessoal/decimo-terceiro');
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro ao carregar cálculo de 13º.' });
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        if (thirteenthId && user && activeCompany) {
            fetchThirteenth();
        }
    }, [thirteenthId, user, activeCompany, toast, router]);
    
    const handleSelectEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsEmployeeModalOpen(false);
        setEvents([]);
        setCalculationResult(null);
    };

    const handleCalculate = async () => {
        if (!selectedEmployee || !year || !parcel) {
            toast({
                variant: 'destructive',
                title: 'Dados incompletos',
                description: 'Por favor, selecione funcionário, ano e parcela.'
            });
            return;
        }

        setIsCalculating(true);
        try {
           const result = calculateThirteenth({
               employee: selectedEmployee,
               year,
               parcel
           });
           setCalculationResult(result);
           setEvents(result.events);

           toast({
                title: 'Cálculo Realizado!',
                description: 'Os valores do 13º foram calculados.'
            });
            await handleSave();

        } catch (error) {
            console.error("Erro no cálculo de 13º:", error);
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
            toast({ variant: 'destructive', title: 'Dados incompletos', description: 'Calcule o 13º antes de salvar.' });
            return;
        }

        setIsSaving(true);
        
        const thirteenthData: Omit<Thirteenth, 'id' | 'createdAt'> = {
            employeeId: selectedEmployee.id!,
            employeeName: selectedEmployee.nomeCompleto,
            year,
            parcel,
            result: calculationResult,
            updatedAt: serverTimestamp(),
        };

        try {
            if (currentThirteenthId) {
                const thirteenthRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/thirteenths`, currentThirteenthId);
                await setDoc(thirteenthRef, { ...thirteenthData, updatedAt: serverTimestamp() }, { merge: true });
                toast({ title: `Cálculo de 13º atualizado com sucesso!` });
            } else {
                const thirteenthsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/thirteenths`);
                const docRef = await addDoc(thirteenthsRef, { ...thirteenthData, createdAt: serverTimestamp() });
                setCurrentThirteenthId(docRef.id);
                router.replace(`/pessoal/decimo-terceiro?id=${docRef.id}`, { scroll: false });
                toast({ title: `Cálculo de 13º salvo com sucesso!` });
            }
        } catch (error) {
            console.error("Erro ao salvar 13º:", error);
            toast({ variant: 'destructive', title: 'Erro ao salvar 13º' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneratePdf = () => {
        if (!activeCompany || !selectedEmployee || !calculationResult) {
            toast({ variant: 'destructive', title: 'Dados incompletos para gerar PDF.' });
            return;
        }

        const thirteenthData: Thirteenth = {
            id: currentThirteenthId || undefined,
            employeeId: selectedEmployee.id!,
            employeeName: selectedEmployee.nomeCompleto,
            year,
            parcel,
            result: calculationResult,
        };
        generateThirteenthReceiptPdf(activeCompany, selectedEmployee, thirteenthData);
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
                    <h1 className="text-2xl font-bold">Cálculo de 13º Salário</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={isSaving || !calculationResult}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                        Salvar Cálculo
                    </Button>
                    <Button onClick={handleCalculate} disabled={isCalculating || !selectedEmployee}>
                        {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Calculator className="mr-2 h-4 w-4"/>}
                        Calcular 13º
                    </Button>
                     <Button variant="secondary" onClick={handleGeneratePdf} disabled={!calculationResult}>
                        <Printer className="mr-2 h-4 w-4" />
                        Visualizar Recibo
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                        <h3 className="text-lg font-semibold">Parâmetros do Cálculo</h3>
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
                                <Label>Ano de Referência</Label>
                                <Input 
                                    type="number"
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    placeholder="Ex: 2024"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Parcela</Label>
                                 <Select value={parcel} onValueChange={(v) => setParcel(v as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="first">1ª Parcela</SelectItem>
                                        <SelectItem value="second">2ª Parcela</SelectItem>
                                        <SelectItem value="unique">Parcela Única</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                                <p className="text-muted-foreground mt-2">Escolha um funcionário para iniciar o cálculo.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : events.length === 0 ? (
                                     <TableRow>
                                        <TableCell colSpan={4}>
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="p-4 bg-muted rounded-full mb-4">
                                                    <Gift className="h-10 w-10 text-muted-foreground" />
                                                </div>
                                                <h3 className="text-xl font-semibold">Aguardando Cálculo</h3>
                                                <p className="text-muted-foreground mt-2">Preencha os parâmetros e clique em "Calcular 13º".</p>
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
