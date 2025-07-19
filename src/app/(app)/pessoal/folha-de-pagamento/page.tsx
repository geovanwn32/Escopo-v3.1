
"use client";

import { useState, useEffect, useMemo } from 'react';
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

export interface PayrollEvent {
    id: string; 
    rubrica: Rubrica;
    referencia: number;
    provento: number;
    desconto: number;
}

export default function FolhaDePagamentoPage() {
    const [events, setEvents] = useState<PayrollEvent[]>([]);
    const [isRubricaModalOpen, setIsRubricaModalOpen] = useState(false);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    
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

    const handleActionClick = (actionName: string) => {
        toast({
            title: `Ação: ${actionName}`,
            description: "A lógica para esta ação ainda não foi implementada.",
        });
    }

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
            
            const updatedEvents = [...events];

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
    
    const { totalProventos, totalDescontos, liquido } = useMemo(() => {
        const totalProventos = events.reduce((acc, event) => acc + event.provento, 0);
        const totalDescontos = events.reduce((acc, event) => acc + event.desconto, 0);
        const liquido = totalProventos - totalDescontos;
        return { totalProventos, totalDescontos, liquido };
    }, [events]);

    return (
        <div className="space-y-4">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">Folha de Pagamento</h1>
                    <HelpCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => handleActionClick('Salvar')}><Save className="mr-2 h-4 w-4"/> Salvar</Button>
                    <Button variant="destructive" onClick={() => handleActionClick('Excluir')}><Trash2 className="mr-2 h-4 w-4"/> Excluir</Button>
                    <Button onClick={handleCalculate} disabled={isCalculating}>
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
                                    disabled={!activeCompany}
                                >
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Período</label>
                             <div className="flex items-center gap-2">
                                <Input placeholder="Ex: 06/2024" />
                                <Button variant="ghost" size="icon"><RefreshCw className="h-4 w-4 text-blue-600"/></Button>
                                <Button variant="ghost" size="icon"><X className="h-4 w-4 text-red-600"/></Button>
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
                                                <Button variant="ghost" size="icon">
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
                                        <TableCell>{event.referencia?.toFixed(2).replace('.', ',')}</TableCell>
                                        <TableCell className="text-right font-medium">{event.provento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                        <TableCell className="text-right font-medium text-red-600">{event.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
