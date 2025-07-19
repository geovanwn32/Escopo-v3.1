
"use client";

import { useState, useEffect } from 'react';
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
} from "lucide-react";
import { PayrollEventBadge } from '@/components/pessoal/payroll-event-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import type { Company } from '@/app/(app)/fiscal/page';
import type { Rubrica } from '@/types/rubrica';
import { RubricaSelectionModal } from '@/components/pessoal/rubrica-selection-modal';

interface PayrollEvent {
    id: string; // Use rubrica's id or a unique generated id
    checked: boolean;
    isAddition: boolean; // Not clear from UI, default to true
    date: string;
    eventCode: string;
    description: string;
    cp: 'S' | 'N';
    fg: 'S' | 'N';
    ir: 'S' | 'N';
    reference: string;
    earning: number;
    deduction: number;
    type: 'provento' | 'desconto';
}

export default function FolhaDePagamentoPage() {
    const [events, setEvents] = useState<PayrollEvent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
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

    const totalEarnings = events.reduce((acc, event) => acc + event.earning, 0);
    const totalDeductions = events.reduce((acc, event) => acc + event.deduction, 0);
    const netPay = totalEarnings - totalDeductions;

    const handleActionClick = (actionName: string) => {
        toast({
            title: `Ação: ${actionName}`,
            description: "A lógica para esta ação ainda não foi implementada.",
        });
    }

    const handleAddEvent = (rubrica: Rubrica) => {
        const newEvent: PayrollEvent = {
            id: rubrica.id!,
            checked: false,
            isAddition: true,
            date: new Date().toLocaleDateString('pt-BR'), // Or period date
            eventCode: rubrica.codigo,
            description: rubrica.descricao,
            cp: rubrica.incideINSS ? 'S' : 'N',
            fg: rubrica.incideFGTS ? 'S' : 'N',
            ir: rubrica.incideIRRF ? 'S' : 'N',
            reference: '0',
            earning: rubrica.tipo === 'provento' ? 0 : 0, // Should be calculated
            deduction: rubrica.tipo === 'desconto' ? 0 : 0, // Should be calculated
            type: rubrica.tipo,
        };

        setEvents(prevEvents => [...prevEvents, newEvent]);
        setIsModalOpen(false);
    };

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
                    <Button onClick={() => handleActionClick('Calcular')}><Calculator className="mr-2 h-4 w-4"/> Calcular</Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Empregado</label>
                            <div className="relative">
                                <Input placeholder="Selecione um funcionário" className="pr-10" />
                                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
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
                            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)} disabled={!activeCompany}><Plus className="mr-2 h-4 w-4"/> Adicionar Evento</Button>
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
                                    <TableHead>Data</TableHead>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>
                                        <div className="flex items-center gap-2">
                                            Histórico
                                            <Input placeholder="Pesquisar por..." className="h-8 max-w-sm" />
                                        </div>
                                    </TableHead>
                                    <TableHead>CP</TableHead>
                                    <TableHead>FG</TableHead>
                                    <TableHead>IR</TableHead>
                                    <TableHead>Referência</TableHead>
                                    <TableHead className="text-right">Rendimento</TableHead>
                                    <TableHead className="text-right">Desconto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {events.length === 0 ? (
                                     <TableRow>
                                        <TableCell colSpan={10}>
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
                                                <Checkbox checked={event.checked} />
                                                <Button variant="ghost" size="icon">
                                                    {event.isAddition ? <Plus className="h-4 w-4 text-green-600" /> : <Trash2 className="h-4 w-4 text-red-600" />}
                                                </Button>
                                                <Button variant="ghost" size="icon"><Info className="h-4 w-4"/></Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>{event.date}</TableCell>
                                        <TableCell>{event.eventCode}</TableCell>
                                        <TableCell>{event.description}</TableCell>
                                        <TableCell><PayrollEventBadge type={event.cp} /></TableCell>
                                        <TableCell><PayrollEventBadge type={event.fg} /></TableCell>
                                        <TableCell><PayrollEventBadge type={event.ir} /></TableCell>
                                        <TableCell>{event.reference}</TableCell>
                                        <TableCell className="text-right font-medium">{event.earning.toFixed(2).replace('.', ',')}</TableCell>
                                        <TableCell className="text-right font-medium text-red-600">{event.deduction.toFixed(2).replace('.', ',')}</TableCell>
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
                             <p className="font-semibold text-lg">{totalEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                           </div>
                            <div className="space-y-1">
                             <p className="font-semibold text-lg text-red-600">{totalDeductions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                           </div>
                           <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Líquido à Receber:</p>
                                <p className="font-bold text-lg text-blue-700">{netPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                           </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {user && activeCompany && (
                <RubricaSelectionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSelect={handleAddEvent}
                    userId={user.uid}
                    companyId={activeCompany.id}
                />
            )}
        </div>
    );
}
