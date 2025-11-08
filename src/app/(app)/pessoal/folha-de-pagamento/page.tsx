
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  HelpCircle,
  Search,
  Plus,
  Save,
  Calculator,
  Info,
  RefreshCw,
  X,
  Trash2,
  Filter,
  FileText,
  Loader2,
  ArrowLeft,
  Printer,
} from "lucide-react";
import { PayrollEventBadge } from '@/components/pessoal/payroll-event-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import type { Company, Rubrica, Employee, Payroll, PayrollEvent } from '@/types';
import { RubricaSelectionModal } from '@/components/pessoal/rubrica-selection-modal';
import { EmployeeSelectionModal } from '@/components/pessoal/employee-selection-modal';
import { calculatePayroll, PayrollCalculationResult } from '@/services/payroll-service';
import { collection, addDoc, doc, setDoc, getDoc, serverTimestamp, Timestamp, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { generatePayslipPdf } from '@/services/payslip-service';
import { calculateAutomaticEvent } from '@/services/payroll-calculator.service';

export interface PayrollTotals {
    totalProventos: number;
    totalDescontos: number;
    liquido: number;
}

export default function FolhaDePagamentoPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const payrollId = searchParams.get('id');
    
    const [events, setEvents] = useState<PayrollEvent[]>([]);
    const [isRubricaModalOpen, setIsRubricaModalOpen] = useState(false);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [currentPayrollId, setCurrentPayrollId] = useState<string | null>(payrollId);
    const [period, setPeriod] = useState<string>('');
    const [status, setStatus] = useState<Payroll['status']>('draft');
    const [calculationResult, setCalculationResult] = useState<PayrollCalculationResult | null>(null);

    // Data for modals
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [rubricas, setRubricas] = useState<Rubrica[]>([]);


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
            } else {
                 setIsLoading(false);
            }
        }
    }, [user]);

    const recalculateAndSetState = useCallback((currentEvents: PayrollEvent[], employee: Employee | null): PayrollCalculationResult | null => {
        if (!employee) return null;
        
        // Filter out old calculated events before passing to the main calculator
        const userAndAutomaticEvents = currentEvents.filter(e => !['inss', 'irrf'].includes(e.rubrica.id!));
        const result = calculatePayroll(employee, userAndAutomaticEvents);
        
        setCalculationResult(result);
        setEvents(result.events);
        
        return result;
    }, []);

    useEffect(() => {
        if (!user || !activeCompany) {
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        let unsubscribes: (() => void)[] = [];

        const fetchData = async () => {
            if (!isMounted) return;
            setIsLoading(true);

            // Fetch Employees
            const empRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/employees`);
            const qEmp = query(empRef, orderBy('nomeCompleto'));
            const unsubEmployees = onSnapshot(qEmp, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), dataAdmissao: doc.data().dataAdmissao.toDate(), dataNascimento: doc.data().dataNascimento.toDate() } as Employee));
                setEmployees(data);
            }, (error) => console.error("Error fetching employees:", error));
            unsubscribes.push(unsubEmployees);

            // Fetch Rubricas
            const rubricasRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/rubricas`);
            const qRubricas = query(rubricasRef, orderBy('descricao'));
            const unsubRubricas = onSnapshot(qRubricas, (snapshot) => {
                 const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rubrica));
                 setRubricas(data);
            }, (error) => console.error("Error fetching rubricas:", error));
            unsubscribes.push(unsubRubricas);

            // Fetch specific payroll if ID exists
            if (payrollId) {
                const payrollRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/payrolls`, payrollId);
                const payrollSnap = await getDoc(payrollRef);
                if (payrollSnap.exists()) {
                    const payrollData = payrollSnap.data() as Payroll;
                    
                    const employeeRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/employees`, payrollData.employeeId);
                    const employeeSnap = await getDoc(employeeRef);

                    let employeeData: Employee | null = null;
                    if (employeeSnap.exists()) {
                         employeeData = {
                            id: employeeSnap.id,
                            ...employeeSnap.data(),
                            dataAdmissao: (employeeSnap.data().dataAdmissao as Timestamp).toDate(),
                            dataNascimento: (employeeSnap.data().dataNascimento as Timestamp).toDate(),
                        } as Employee
                        setSelectedEmployee(employeeData);
                    }
                    
                    setPeriod(payrollData.period);
                    setStatus(payrollData.status);
                    setCurrentPayrollId(payrollSnap.id);
                    if (employeeData) {
                      recalculateAndSetState(payrollData.events, employeeData);
                    }
                } else {
                    toast({ variant: 'destructive', title: 'Folha de pagamento não encontrada.' });
                    router.push('/pessoal/folha-de-pagamento');
                }
            } else {
                 // Reset state if no payroll ID is provided
                setSelectedEmployee(null);
                setEvents([]);
                setCalculationResult(null);
                setCurrentPayrollId(null);
                const now = new Date();
                const currentPeriod = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                setPeriod(currentPeriod);
            }
             setIsLoading(false);
        };
        
        fetchData();

        return () => {
            isMounted = false;
            unsubscribes.forEach(unsub => unsub());
        };
    }, [user, activeCompany, payrollId, router, toast, recalculateAndSetState]);
    
    const handleEventChange = (eventId: string, field: 'referencia' | 'provento' | 'desconto', value: string) => {
        const sanitizedValue = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
        
        let updatedEvents = events.map(event =>
            event.id === eventId ? { ...event, [field]: sanitizedValue } : event
        );

        const currentEvent = updatedEvents.find(e => e.id === eventId);
        
        if (selectedEmployee && currentEvent && field === 'referencia') {
            const currentEventsWithoutCalculated = updatedEvents.filter(e => !['inss', 'irrf'].includes(e.rubrica.id!));
            const calculatedEvent = calculateAutomaticEvent(currentEvent.rubrica, selectedEmployee, currentEventsWithoutCalculated, sanitizedValue);
            if (calculatedEvent) {
                updatedEvents = updatedEvents.map(event =>
                    event.id === eventId ? { ...event, ...calculatedEvent } : event
                );
            }
        }
        
        recalculateAndSetState(updatedEvents, selectedEmployee);
        setStatus('draft');
    };

    const handleAddEvent = (rubrica: Rubrica) => {
        if (!selectedEmployee) return;

        const currentEvents = events.filter(e => !['inss', 'irrf'].includes(e.rubrica.id!));
        const calculatedEvent = calculateAutomaticEvent(rubrica, selectedEmployee, currentEvents);

        const newEvent: PayrollEvent = {
            id: rubrica.id!,
            rubrica: rubrica,
            referencia: calculatedEvent?.referencia || 0,
            provento: calculatedEvent?.provento || 0,
            desconto: calculatedEvent?.desconto || 0,
        };

        const updatedEvents = [...events, newEvent];
        recalculateAndSetState(updatedEvents, selectedEmployee);
        setStatus('draft');
        setIsRubricaModalOpen(false);
    };

    const handleRemoveEvent = (eventId: string) => {
        if (!selectedEmployee) return;
        const updatedEvents = events.filter(event => event.id !== eventId);
        recalculateAndSetState(updatedEvents, selectedEmployee);
        setStatus('draft');
    };

    const handleSelectEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsEmployeeModalOpen(false);

        const baseSalaryEvent: PayrollEvent = {
            id: 'salario_base',
            rubrica: {
                id: 'salario_base',
                codigo: '100',
                descricao: 'SALÁRIO BASE',
                tipo: 'provento',
                incideINSS: true,
                incideFGTS: true,
                incideIRRF: true,
                naturezaESocial: '1000'
            },
            referencia: 30, // days
            provento: employee.salarioBase,
            desconto: 0
        };
        
        recalculateAndSetState([baseSalaryEvent], employee);
        setStatus('draft');
    };

    const handleCalculate = async () => {
        if (!selectedEmployee) {
            toast({
                variant: 'destructive',
                title: 'Nenhum funcionário selecionado',
                description: 'Por favor, selecione um funcionário para calcular a folha.'
            });
            return;
        }

        setIsCalculating(true);
        try {
            const currentEvents = events.filter(e => !['inss', 'irrf'].includes(e.rubrica.id!));
            let finalEvents = [...currentEvents];
            
            for(let i = 0; i < finalEvents.length; i++) {
                const event = finalEvents[i];
                const calculated = calculateAutomaticEvent(event.rubrica, selectedEmployee, finalEvents, event.referencia);
                if (calculated) {
                    finalEvents[i] = { ...event, ...calculated };
                }
            }
            
            recalculateAndSetState(finalEvents, selectedEmployee);
            setStatus('calculated');
            toast({
                title: 'Cálculo Realizado!',
                description: 'Os valores foram recalculados e salvos.'
            });
            
            await handleSave(true);

        } catch (error) {
            console.error("Erro no cálculo da folha:", error);
            toast({
                variant: 'destructive',
                title: 'Erro no cálculo',
                description: (error as Error).message,
            })
        } finally {
            setIsCalculating(false);
        }
    };
    
    const { totalProventos, totalDescontos, liquido } = useMemo<PayrollTotals>(() => {
        if (!calculationResult) return { totalProventos: 0, totalDescontos: 0, liquido: 0 };
        return {
            totalProventos: calculationResult.totalProventos,
            totalDescontos: calculationResult.totalDescontos,
            liquido: calculationResult.liquido
        }
    }, [calculationResult]);
    
    const handleSave = async (isCalculation: boolean = false) => {
        if (!user || !activeCompany || !selectedEmployee || !period) {
            toast({ variant: 'destructive', title: 'Dados incompletos', description: 'Selecione funcionário e período para salvar.' });
            return;
        }

        setIsSaving(true);
        
        const calcResult = calculatePayroll(selectedEmployee, events);
        if (!calcResult) {
            setIsSaving(false);
            return;
        }

        const finalStatus = isCalculation ? 'calculated' : 'draft';

        const payrollData: Omit<Payroll, 'id' | 'createdAt'> = {
            employeeId: selectedEmployee.id!,
            employeeName: selectedEmployee.nomeCompleto,
            period,
            status: finalStatus,
            events: events.filter(e => !['inss', 'irrf'].includes(e.rubrica.id!)),
            totals: { totalProventos: calcResult.totalProventos, totalDescontos: calcResult.totalDescontos, liquido: calcResult.liquido },
            baseINSS: calcResult.baseINSS,
            baseIRRF: calcResult.baseIRRF,
            baseFGTS: calcResult.baseFGTS,
            fgtsValue: calcResult.fgts.valor,
            updatedAt: serverTimestamp(),
        };

        try {
            if (currentPayrollId) {
                const payrollRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/payrolls`, currentPayrollId);
                await setDoc(payrollRef, { ...payrollData, updatedAt: serverTimestamp() }, { merge: true });
                if (!isCalculation) {
                    toast({ title: `Folha de pagamento atualizada como Rascunho!` });
                }
            } else {
                const payrollsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/payrolls`);
                const docRef = await addDoc(payrollsRef, { ...payrollData, createdAt: serverTimestamp() });
                setCurrentPayrollId(docRef.id);
                router.replace(`/pessoal/folha-de-pagamento?id=${docRef.id}`, { scroll: false });
                if (!isCalculation) {
                  toast({ title: `Folha de pagamento salva como Rascunho!` });
                }
            }
            setStatus(finalStatus);
        } catch (error) {
            console.error("Erro ao salvar folha:", error);
            toast({ variant: 'destructive', title: 'Erro ao salvar folha' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!currentPayrollId || !user || !activeCompany) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/payrolls`, currentPayrollId));
            toast({ title: 'Rascunho excluído com sucesso!' });
            router.push('/pessoal');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao excluir rascunho.' });
        }
    };

    const handleGeneratePdf = () => {
        if (!activeCompany || !selectedEmployee) {
            toast({ variant: 'destructive', title: 'Dados incompletos para gerar PDF.' });
            return;
        }

        const calcResult = calculatePayroll(selectedEmployee, events);
        if (!calcResult) return;

        const payrollData: Payroll = {
            id: currentPayrollId || undefined,
            employeeId: selectedEmployee.id!,
            employeeName: selectedEmployee.nomeCompleto,
            period,
            status,
            events, 
            totals: { totalProventos: calcResult.totalProventos, totalDescontos: calcResult.totalDescontos, liquido: calcResult.liquido },
            baseINSS: calcResult.baseINSS,
            baseIRRF: calcResult.baseIRRF,
            baseFGTS: calcResult.baseFGTS,
            fgtsValue: calcResult.fgts.valor,
            updatedAt: new Date(),
        };
        generatePayslipPdf(activeCompany, selectedEmployee, payrollData);
    };

    const isEventRemovable = (eventId: string) => {
        return !['salario_base', 'inss', 'irrf'].includes(eventId);
    };

    const isFieldEditable = (event: PayrollEvent): boolean => {
      // Allow editing unless it's a core system-calculated event
      return !['salario_base', 'inss', 'irrf'].includes(event.id);
    }

    const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;
        value = value.replace(/\D/g, ''); 
        if (value.length > 2) {
            value = `${value.slice(0, 2)}/${value.slice(2, 6)}`;
        }
        setPeriod(value);
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    const formatNumberForDisplay = (num: number, options?: Intl.NumberFormatOptions) => {
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            ...options
        });
    };

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
                    <h1 className="text-2xl font-bold">Folha de Pagamento</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving || !selectedEmployee || isCalculating}>
                        {isSaving && !isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                        Salvar Rascunho
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button variant="destructive" disabled={!currentPayrollId}><Trash2 className="mr-2 h-4 w-4"/> Excluir</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O rascunho da folha de pagamento será permanentemente removido.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={handleCalculate} disabled={isCalculating || !selectedEmployee}>
                        {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Calculator className="mr-2 h-4 w-4"/>}
                        Calcular e Salvar
                    </Button>
                     <Button variant="secondary" onClick={handleGeneratePdf} disabled={status !== 'calculated' && status !== 'finalized'}>
                        <Printer className="mr-2 h-4 w-4" />
                        Visualizar Holerite
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                    disabled={!activeCompany || !!currentPayrollId}
                                    title={currentPayrollId ? "Não é possível alterar o funcionário de um rascunho salvo." : "Selecionar funcionário"}
                                >
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Período</label>
                             <div className="flex items-center gap-2">
                                <Input placeholder="Ex: 07/2024" value={period} onChange={handlePeriodChange} maxLength={7} />
                                <Button variant="ghost" size="icon" disabled><RefreshCw className="h-4 w-4 text-blue-600"/></Button>
                                <Button variant="ghost" size="icon" disabled><X className="h-4 w-4 text-red-600"/></Button>
                            </div>
                        </div>
                         <div className="space-y-1">
                             <label className="text-sm font-medium">Origem</label>
                            <div className="flex items-center gap-2">
                                <Select defaultValue="todas">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">Todas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                     <div className="flex justify-between items-center bg-muted p-2 rounded-md">
                        <div className="flex items-center gap-2 text-sm">
                           <p className="text-sm">0 de 0 Registros</p>
                           <div className="flex gap-1">
                                <Button variant="ghost" size="icon" disabled><ChevronsLeft className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" disabled><ChevronLeft className="h-4 w-4"/></Button>
                                <span className="p-2">1 / 1</span>
                                <Button variant="ghost" size="icon" disabled><ChevronRight className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" disabled><ChevronsRight className="h-4 w-4"/></Button>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsRubricaModalOpen(true)} disabled={!activeCompany || !selectedEmployee}><Plus className="mr-2 h-4 w-4"/> Adicionar Evento</Button>
                        </div>
                    </div>

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon"><Filter className="h-4 w-4"/></Button>
                                        </div>
                                    </TableHead>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>
                                        <div className="flex items-center gap-2">
                                            Descrição
                                            <Input placeholder="Pesquisar por..." className="h-8 max-w-sm" />
                                        </div>
                                    </TableHead>
                                    <TableHead>CP</TableHead>
                                    <TableHead>FG</TableHead>
                                    <TableHead>IR</TableHead>
                                    <TableHead>Referência</TableHead>
                                    <TableHead className="text-right">Provento</TableHead>
                                    <TableHead className="text-right">Desconto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!selectedEmployee ? (
                                    <TableRow>
                                        <TableCell colSpan={9}>
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="p-4 bg-muted rounded-full mb-4">
                                                    <Search className="h-10 w-10 text-muted-foreground" />
                                                </div>
                                                <h3 className="text-xl font-semibold">Selecione um funcionário</h3>
                                                <p className="text-muted-foreground mt-2">Use o botão de busca para escolher um funcionário e iniciar o cálculo.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : events.length === 0 ? (
                                     <TableRow>
                                        <TableCell colSpan={9}>
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="p-4 bg-muted rounded-full mb-4">
                                                    <FileText className="h-10 w-10 text-muted-foreground" />
                                                </div>
                                                <h3 className="text-xl font-semibold">Nenhum evento lançado</h3>
                                                <p className="text-muted-foreground mt-2">Clique em "Adicionar Evento" para começar.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : events.map((event) => (
                                    <TableRow key={event.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Checkbox />
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleRemoveEvent(event.id)}
                                                    disabled={!isEventRemovable(event.id)}
                                                    title={isEventRemovable(event.id) ? "Remover Evento" : "Este evento não pode ser removido"}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                                <Button variant="ghost" size="icon"><Info className="h-4 w-4"/></Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>{event.rubrica.codigo}</TableCell>
                                        <TableCell>{event.rubrica.descricao}</TableCell>
                                        <TableCell><PayrollEventBadge type={event.rubrica.incideINSS ? 'S' : 'N'} /></TableCell>
                                        <TableCell><PayrollEventBadge type={event.rubrica.incideFGTS ? 'S' : 'N'} /></TableCell>
                                        <TableCell><PayrollEventBadge type={event.rubrica.incideIRRF ? 'S' : 'N'} /></TableCell>
                                        <TableCell>
                                            <Input
                                                type="text"
                                                className="h-8 w-20 text-right"
                                                defaultValue={formatNumberForDisplay(event.referencia, { maximumFractionDigits: 10 })}
                                                onBlur={(e) => handleEventChange(event.id, 'referencia', e.target.value)}
                                                readOnly={!isFieldEditable(event)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                             <Input
                                                type="text"
                                                className="h-8 w-28 text-right"
                                                defaultValue={formatNumberForDisplay(event.provento)}
                                                onBlur={(e) => handleEventChange(event.id, 'provento', e.target.value)}
                                                readOnly={!isFieldEditable(event)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-red-600">
                                            <Input
                                                type="text"
                                                className="h-8 w-28 text-right"
                                                defaultValue={formatNumberForDisplay(event.desconto)}
                                                onBlur={(e) => handleEventChange(event.id, 'desconto', e.target.value)}
                                                readOnly={!isFieldEditable(event)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-sm">
                             <Select defaultValue="30">
                                <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="30 / Página" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10 / Página</SelectItem>
                                    <SelectItem value="20">20 / Página</SelectItem>
                                    <SelectItem value="30">30 / Página</SelectItem>
                                    <SelectItem value="50">50 / Página</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1">
                               <Button variant="ghost" size="icon" disabled><ChevronsLeft className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" disabled><ChevronLeft className="h-4 w-4"/></Button>
                                <span className="p-2">1 / 1</span>
                                <Button variant="ghost" size="icon" disabled><ChevronRight className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" disabled><ChevronsRight className="h-4 w-4"/></Button>
                            </div>
                             <p>{events.length} Registros</p>
                        </div>
                        <div className="flex gap-6 text-right">
                           <div className="space-y-1">
                             <p className="font-semibold text-lg">{formatNumberForDisplay(totalProventos, { style: 'currency', currency: 'BRL' })}</p>
                           </div>
                            <div className="space-y-1">
                             <p className="font-semibold text-lg text-red-600">{formatNumberForDisplay(totalDescontos, { style: 'currency', currency: 'BRL' })}</p>
                           </div>
                           <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Líquido à Receber:</p>
                                <p className="font-bold text-lg text-blue-700">{formatNumberForDisplay(liquido, { style: 'currency', currency: 'BRL' })}</p>
                           </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {user && activeCompany && (
                <RubricaSelectionModal
                    isOpen={isRubricaModalOpen}
                    onClose={() => setIsRubricaModalOpen(false)}
                    onSelect={handleAddEvent}
                    userId={user.uid}
                    companyId={activeCompany.id}
                />
            )}

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
