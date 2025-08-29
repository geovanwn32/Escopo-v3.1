
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  HelpCircle,
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
import { calculateTermination, TerminationResult } from '@/services/termination-service';
import { collection, addDoc, doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Termination } from '@/types/termination';
import Link from 'next/link';
import { DateInput } from '@/components/ui/date-input';
import { generateTrctPdf } from '@/services/trct-service';


export default function TerminationPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const terminationId = searchParams.get('id');

    const [events, setEvents] = useState<TerminationResult['events']>([]);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isLoading, setIsLoading] = useState(!!terminationId);
    const [isSaving, setIsSaving] = useState(false);
    const [currentTerminationId, setCurrentTerminationId] = useState<string | null>(terminationId);
    
    // Form state
    const [terminationDate, setTerminationDate] = useState<Date | undefined>();
    const [terminationReason, setTerminationReason] = useState('');
    const [noticeType, setNoticeType] = useState('');
    const [fgtsBalance, setFgtsBalance] = useState<number>(0);

    const [calculationResult, setCalculationResult] = useState<TerminationResult | null>(null);

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
        const fetchTermination = async () => {
             if (!terminationId || !user || !activeCompany) {
                setIsLoading(false);
                return;
            };
            setIsLoading(true);
             try {
                const termRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/terminations`, terminationId);
                const termSnap = await getDoc(termRef);
                 if (termSnap.exists()) {
                    const data = termSnap.data() as Termination;
                    
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
                    
                    setTerminationDate((data.terminationDate as Timestamp).toDate());
                    setTerminationReason(data.reason);
                    setNoticeType(data.noticeType);
                    setFgtsBalance(data.fgtsBalance);
                    setCurrentTerminationId(termSnap.id);
                    setCalculationResult(data.result);
                    setEvents(data.result.events);

                } else {
                    toast({ variant: 'destructive', title: 'Rescisão não encontrada.' });
                    router.push('/pessoal/rescisao');
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro ao carregar rescisão.' });
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        if (terminationId && user && activeCompany) {
            fetchTermination();
        }
    }, [terminationId, user, activeCompany, toast, router]);
    
    const handleSelectEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsEmployeeModalOpen(false);
        setEvents([]);
        setCalculationResult(null);
    };

    const handleCalculate = async () => {
        if (!selectedEmployee || !terminationDate || !terminationReason || !noticeType) {
            toast({
                variant: 'destructive',
                title: 'Dados incompletos',
                description: 'Por favor, preencha todos os campos para calcular a rescisão.'
            });
            return;
        }

        setIsCalculating(true);
        try {
           const result = calculateTermination({
               employee: selectedEmployee,
               terminationDate,
               reason: terminationReason,
               noticeType,
               fgtsBalance
           });
           setCalculationResult(result);
           setEvents(result.events);

           toast({
                title: 'Cálculo Realizado!',
                description: 'Os valores da rescisão foram calculados.'
            });
            await handleSave();

        } catch (error) {
            console.error("Erro no cálculo da rescisão:", error);
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
            toast({ variant: 'destructive', title: 'Dados incompletos', description: 'Calcule a rescisão antes de salvar.' });
            return;
        }

        setIsSaving(true);
        
        const terminationData: Omit<Termination, 'id' | 'createdAt'> = {
            employeeId: selectedEmployee.id!,
            employeeName: selectedEmployee.nomeCompleto,
            terminationDate: terminationDate!,
            reason: terminationReason,
            noticeType,
            fgtsBalance,
            result: calculationResult,
            updatedAt: serverTimestamp(),
        };

        try {
            if (currentTerminationId) {
                const termRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/terminations`, currentTerminationId);
                await setDoc(termRef, { ...terminationData, updatedAt: serverTimestamp() }, { merge: true });
                toast({ title: `Rescisão atualizada com sucesso!` });
            } else {
                const termsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/terminations`);
                const docRef = await addDoc(termsRef, { ...terminationData, createdAt: serverTimestamp() });
                setCurrentTerminationId(docRef.id);
                router.replace(`/pessoal/rescisao?id=${docRef.id}`, { scroll: false });
                toast({ title: `Rescisão salva com sucesso!` });
            }
        } catch (error) {
            console.error("Erro ao salvar rescisão:", error);
            toast({ variant: 'destructive', title: 'Erro ao salvar rescisão' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneratePdf = () => {
        if (!activeCompany || !selectedEmployee || !calculationResult || !terminationDate) {
            toast({ variant: 'destructive', title: 'Dados incompletos para gerar PDF.' });
            return;
        }

        const terminationData: Termination = {
            id: currentTerminationId || undefined,
            employeeId: selectedEmployee.id!,
            employeeName: selectedEmployee.nomeCompleto,
            terminationDate: terminationDate!,
            reason: terminationReason,
            noticeType,
            fgtsBalance,
            result: calculationResult,
        };
        generateTrctPdf(activeCompany, selectedEmployee, terminationData);
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
                    <h1 className="text-2xl font-bold">Cálculo de Rescisão</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={isSaving || !calculationResult}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                        Salvar Rescisão
                    </Button>
                    <Button onClick={handleCalculate} disabled={isCalculating || !selectedEmployee}>
                        {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Calculator className="mr-2 h-4 w-4"/>}
                        Calcular Rescisão
                    </Button>
                     <Button variant="secondary" onClick={handleGeneratePdf} disabled={!calculationResult}>
                        <Printer className="mr-2 h-4 w-4" />
                        Visualizar TRCT
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                        <h3 className="text-lg font-semibold">Parâmetros da Rescisão</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Empregado</label>
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
                                <label className="text-sm font-medium">Data da Rescisão</label>
                                <DateInput value={terminationDate} onChange={setTerminationDate} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Motivo</label>
                                <Select value={terminationReason} onValueChange={setTerminationReason}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dispensa_sem_justa_causa">Dispensa sem Justa Causa</SelectItem>
                                        <SelectItem value="pedido_demissao">Pedido de Demissão</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1">
                                <label className="text-sm font-medium">Aviso Prévio</label>
                                <Select value={noticeType} onValueChange={setNoticeType}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="indenizado">Indenizado</SelectItem>
                                        <SelectItem value="trabalhado">Trabalhado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1 col-span-1 md:col-span-2 lg:col-span-4">
                                <label className="text-sm font-medium">Saldo FGTS para Fins Rescisórios (R$)</label>
                                <Input 
                                    type="text"
                                    value={fgtsBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                                        setFgtsBalance(value);
                                    }}
                                />
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
                                                <p className="text-muted-foreground mt-2">Escolha um funcionário para iniciar o cálculo da rescisão.</p>
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
                                                <p className="text-muted-foreground mt-2">Preencha os parâmetros e clique em "Calcular Rescisão".</p>
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
                                <p className="text-sm text-muted-foreground">Líquido da Rescisão:</p>
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
