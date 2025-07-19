

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
} from "lucide-react";
import { PayrollEventBadge } from '@/components/pessoal/payroll-event-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import type { Company } from '@/app/(app)/fiscal/page';
import type { Rubrica } from '@/types/rubrica';
import { RubricaSelectionModal } from '@/components/pessoal/rubrica-selection-modal';
import type { Employee } from '@/types/employee';
import { EmployeeSelectionModal } from '@/components/pessoal/employee-selection-modal';
import { calculatePayroll, PayrollCalculationResult } from '@/services/payroll-service';
import { collection, addDoc, doc, setDoc, getDoc, serverTimestamp, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Payroll } from '@/types/payroll';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export interface PayrollEvent {
    id: string; 
    rubrica: Rubrica;
    referencia: number;
    provento: number;
    desconto: number;
}

export interface PayrollTotals {
    totalProventos: number;
    totalDescontos: number;
    liquido: number;
}

export default function FolhaDePagamentoPage() {
    const searchParams = useSearchParams();
    const payrollId = searchParams.get('id');
    const router = useRouter();

    const [events, setEvents] = useState<PayrollEvent[]>([]);
    const [isRubricaModalOpen, setIsRubricaModalOpen] = useState(false);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isLoading, setIsLoading] = useState(!!payrollId);
    const [isSaving, setIsSaving] = useState(false);
    const [currentPayrollId, setCurrentPayrollId] = useState<string | null>(payrollId);
    const [period, setPeriod] = useState<string>('');

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
        const fetchPayroll = async () => {
            if (!payrollId || !user || !activeCompany) {
                setIsLoading(false);
                return;
            };

            setIsLoading(true);
            try {
                const payrollRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/payrolls`, payrollId);
                const payrollSnap = await getDoc(payrollRef);

                if (payrollSnap.exists()) {
                    const payrollData = payrollSnap.data() as Payroll;
                    
                    const employeeRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/employees`, payrollData.employeeId);
                    const employeeSnap = await getDoc(employeeRef);

                    if (employeeSnap.exists()) {
                         const employeeData = {
                            id: employeeSnap.id,
                            ...employeeSnap.data(),
                            dataAdmissao: (employeeSnap.data().dataAdmissao as Timestamp).toDate(),
                            dataNascimento: (employeeSnap.data().dataNascimento as Timestamp).toDate(),
                        } as Employee
                        setSelectedEmployee(employeeData);
                    }
                    
                    setPeriod(payrollData.period);
                    setEvents(payrollData.events);
                    setCurrentPayrollId(payrollData.id!);

                } else {
                    toast({ variant: 'destructive', title: 'Folha de pagamento não encontrada.' });
                    router.push('/pessoal/folha-de-pagamento');
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro ao carregar folha de pagamento.' });
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };

        if (payrollId && user && activeCompany) {
            fetchPayroll();
        }
    }, [payrollId, user, activeCompany, toast, router]);
    
    const handleEventChange = (eventId: string, field: 'referencia' | 'provento' | 'desconto', value: string) => {
        const numericValue = parseFloat(value.replace(',', '.')) || 0;
        setEvents(prevEvents =>
            prevEvents.map(event =>
                event.id === eventId ? { ...event, [field]: numericValue } : event
            )
        );
    };

    const handleAddEvent = (rubrica: Rubrica) => {
        const newEvent: PayrollEvent = {
            id: rubrica.id!,
            rubrica: rubrica,
            referencia: 0,
            provento: 0,
            desconto: 0,
        };

        setEvents(prevEvents => [...prevEvents, newEvent]);
        setIsRubricaModalOpen(false);
    };

    const handleRemoveEvent = (eventId: string) => {
        setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
    };

    const handleSelectEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        
        // Auto-add base salary event
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

        setEvents([baseSalaryEvent]);
        setIsEmployeeModalOpen(false);
    };

    const handleCalculate = () => {
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
            const result = calculatePayroll(selectedEmployee, events);
            
            const updatedEvents = [...events.filter(e => !['inss', 'irrf'].includes(e.id))];

            const addOrUpdateEvent = (newEvent: PayrollEvent) => {
                const index = updatedEvents.findIndex(e => e.rubrica.id === newEvent.rubrica.id);
                if (index > -1) {
                    updatedEvents[index] = newEvent;
                } else {
                    updatedEvents.push(newEvent);
                }
            };

            // Add INSS calculation result
            if (result.inss.valor > 0) {
                 addOrUpdateEvent({
                    id: 'inss',
                    rubrica: { id: 'inss', codigo: '901', descricao: 'INSS SOBRE SALÁRIO', tipo: 'desconto', incideINSS: false, incideFGTS: false, incideIRRF: false, naturezaESocial: '9201' },
                    referencia: result.inss.aliquota,
                    provento: 0,
                    desconto: result.inss.valor,
                });
            }

            // Add IRRF calculation result
             if (result.irrf.valor > 0) {
                 addOrUpdateEvent({
                    id: 'irrf',
                    rubrica: { id: 'irrf', codigo: '902', descricao: 'IRRF SOBRE SALÁRIO', tipo: 'desconto', incideINSS: false, incideFGTS: false, incideIRRF: false, naturezaESocial: '9202' },
                    referencia: result.irrf.aliquota,
                    provento: 0,
                    desconto: result.irrf.valor,
                });
            }

            setEvents(updatedEvents);
            toast({
                title: 'Cálculo Realizado!',
                description: 'Os valores de INSS e IRRF foram calculados e adicionados.'
            });

        } catch (error) {
            console.error("Payroll calculation error:", error);
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
        const totalProventos = events.reduce((acc, event) => acc + event.provento, 0);
        const totalDescontos = events.reduce((acc, event) => acc + event.desconto, 0);
        const liquido = totalProventos - totalDescontos;
        return { totalProventos, totalDescontos, liquido };
    }, [events]);
    
    const handleSave = async () => {
        if (!user || !activeCompany || !selectedEmployee || !period) {
            toast({ variant: 'destructive', title: 'Dados incompletos', description: 'Selecione funcionário e período para salvar.' });
            return;
        }

        setIsSaving(true);
        const payrollData: Omit<Payroll, 'id' | 'createdAt'> = {
            employeeId: selectedEmployee.id!,
            employeeName: selectedEmployee.nomeCompleto,
            period,
            status: 'draft',
            events,
            totals: { totalProventos, totalDescontos, liquido },
            updatedAt: serverTimestamp(),
        };

        try {
            if (currentPayrollId) {
                // Update existing payroll
                const payrollRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/payrolls`, currentPayrollId);
                await setDoc(payrollRef, payrollData, { merge: true });
                toast({ title: 'Rascunho atualizado com sucesso!' });
            } else {
                // Create new payroll
                const payrollsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/payrolls`);
                const docRef = await addDoc(payrollsRef, { ...payrollData, createdAt: serverTimestamp() });
                setCurrentPayrollId(docRef.id);
                toast({ title: 'Folha de pagamento salva como rascunho!' });
                router.replace(`/pessoal/folha-de-pagamento?id=${docRef.id}`);
            }
        } catch (error) {
            console.error("Error saving payroll:", error);
            toast({ variant: 'destructive', title: 'Erro ao salvar rascunho' });
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

    const isEventRemovable = (eventId: string) => {
        return !['salario_base', 'inss', 'irrf'].includes(eventId);
    };

    const isFieldEditable = (event: PayrollEvent, field: 'referencia' | 'provento'): boolean => {
      if (event.rubrica.tipo === 'desconto') return false; // Descontos não são editáveis diretamente
      if (event.id === 'salario_base' && field === 'provento') return false; // Salário base não é editável diretamente
      return true;
    }

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
                    <h1 className="text-2xl font-bold">Folha de Pagamento</h1>
                    <HelpCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleSave} disabled={isSaving || !selectedEmployee}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                        Salvar
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
                        Calcular
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
                                <Input placeholder="Ex: 07/2024" value={period} onChange={e => setPeriod(e.target.value)} />
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
                        <div className="flex items-center gap-2">
                           <p className="text-sm">0 de 0 Registros</p>
                           <div className="flex gap-1">
                                <Button variant="ghost" size="icon" disabled><ChevronsLeft className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" disabled><ChevronLeft className="h-4 w-4"/></Button>
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
                                                value={event.referencia?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                onChange={(e) => handleEventChange(event.id, 'referencia', e.target.value)}
                                                readOnly={!isFieldEditable(event, 'referencia')}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <Input
                                                type="text"
                                                className="h-8 w-28 text-right"
                                                value={event.provento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                onChange={(e) => handleEventChange(event.id, 'provento', e.target.value)}
                                                readOnly={!isFieldEditable(event, 'provento')}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-red-600">
                                            {event.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                             <p className="font-semibold text-lg">{totalProventos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                           </div>
                            <div className="space-y-1">
                             <p className="font-semibold text-lg text-red-600">{totalDescontos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                           </div>
                           <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Líquido à Receber:</p>
                                <p className="font-bold text-lg text-blue-700">{liquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
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
