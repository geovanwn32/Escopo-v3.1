
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
import type { Company, Rubrica, RCI, RciEvent, RciTotals, Socio } from '@/types';
import { RubricaSelectionModal } from '@/components/pessoal/rubrica-selection-modal';
import { SocioSelectionModal } from '@/components/socios/socio-selection-modal';
import { calculatePayroll, PayrollCalculationResult } from '@/services/payroll-service';
import { collection, addDoc, doc, setDoc, getDoc, serverTimestamp, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { generateProLaboreReceiptPdf } from '@/services/pro-labore-receipt-service';
import { useForm } from 'react-hook-form';

export default function RciPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const rciId = searchParams.get('id');

    const [events, setEvents] = useState<RciEvent[]>([]);
    const [isRubricaModalOpen, setIsRubricaModalOpen] = useState(false);
    const [isSocioModalOpen, setIsSocioModalOpen] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [selectedSocio, setSelectedSocio] = useState<Socio | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isLoading, setIsLoading] = useState(!!rciId);
    const [isSaving, setIsSaving] = useState(false);
    const [currentRciId, setCurrentRciId] = useState<string | null>(rciId);
    const [period, setPeriod] = useState<string>('');
    const [status, setStatus] = useState<RCI['status']>('draft');
    const [calculationResult, setCalculationResult] = useState<PayrollCalculationResult | null>(null);

    const form = useForm(); // Form is now defined here
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

    const recalculateAndSetState = useCallback((currentEvents: RciEvent[], socio: Socio | null): PayrollCalculationResult | null => {
        if (!socio) {
            setCalculationResult(null);
            setEvents([]);
            return null;
        }
        
        const mockSocioAsEmployee: any = {
          ...socio,
          salarioBase: socio.proLabore,
          dependentes: [], 
          isSocio: true,
        }

        // Filter out old calculated events before recalculating
        const userEvents = currentEvents.filter(e => e.rubrica.id !== 'inss' && e.rubrica.id !== 'irrf');

        const result = calculatePayroll(mockSocioAsEmployee, userEvents);
        setCalculationResult(result);
        setEvents(result.events as RciEvent[]);
        return result;
    }, []);

    useEffect(() => {
        const fetchRci = async () => {
            if (!rciId || !user || !activeCompany) {
                setIsLoading(false);
                return;
            };

            setIsLoading(true);
            form.reset();
            setSelectedSocio(null);
            setEvents([]);
            setCalculationResult(null);

            try {
                const rciRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/rcis`, rciId);
                const rciSnap = await getDoc(rciRef);

                if (rciSnap.exists()) {
                    const rciData = rciSnap.data() as RCI;
                    
                    const socioRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/socios`, rciData.socioId);
                    const socioSnap = await getDoc(socioRef);

                    let socioData: Socio | null = null;
                    if (socioSnap.exists()) {
                         socioData = {
                            id: socioSnap.id,
                            ...socioSnap.data(),
                            dataEntrada: (socioSnap.data().dataEntrada as Timestamp).toDate(),
                            dataNascimento: (socioSnap.data().dataNascimento as Timestamp).toDate(),
                        } as Socio
                        setSelectedSocio(socioData);
                    }
                    
                    setPeriod(rciData.period);
                    setStatus(rciData.status);
                    setCurrentRciId(rciSnap.id);
                    if (socioData) {
                      recalculateAndSetState(rciData.events, socioData);
                    }

                } else {
                    toast({ variant: 'destructive', title: 'RCI não encontrado.' });
                    router.push('/pessoal');
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro ao carregar RCI.' });
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };

        if (rciId && user && activeCompany) {
            fetchRci();
        } else {
            setIsLoading(false);
        }
    }, [rciId, user, activeCompany, toast, router, recalculateAndSetState, form]);
    
    const handleEventChange = (eventId: string, field: 'referencia' | 'provento' | 'desconto', value: string) => {
        const sanitizedValue = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
        
        const updatedEvents = events.map(event =>
            event.id === eventId ? { ...event, [field]: sanitizedValue } : event
        );
        
        recalculateAndSetState(updatedEvents, selectedSocio);
        setStatus('draft');
    };

    const handleAddEvent = (rubrica: Rubrica) => {
        if (!selectedSocio) return;

        const newEvent: RciEvent = {
            id: rubrica.id!,
            rubrica: rubrica,
            referencia: 0,
            provento: 0,
            desconto: 0,
        };

        const updatedEvents = [...events, newEvent];
        recalculateAndSetState(updatedEvents, selectedSocio);
        setStatus('draft');
        setIsRubricaModalOpen(false);
    };

    const handleRemoveEvent = (eventId: string) => {
        if (!selectedSocio) return;
        const updatedEvents = events.filter(event => event.id !== eventId);
        recalculateAndSetState(updatedEvents, selectedSocio);
        setStatus('draft');
    };

    const handleSelectSocio = (socio: Socio) => {
        setSelectedSocio(socio);
        setIsSocioModalOpen(false);

        const proLaboreEvent: RciEvent = {
            id: 'pro_labore',
            rubrica: {
                id: 'pro_labore',
                codigo: '350',
                descricao: 'PRÓ-LABORE',
                tipo: 'provento',
                incideINSS: true,
                incideFGTS: false, // Pro-labore doesn't have FGTS
                incideIRRF: true,
                naturezaESocial: '1000' // Using same as salary for now
            },
            referencia: 30, // days
            provento: socio.proLabore,
            desconto: 0
        };
        
        recalculateAndSetState([proLaboreEvent], socio);
        setStatus('draft');
    };

    const handleCalculate = async () => {
        if (!selectedSocio) {
            toast({
                variant: 'destructive',
                title: 'Nenhum sócio selecionado',
                description: 'Por favor, selecione um sócio para calcular o RCI.'
            });
            return;
        }

        setIsCalculating(true);
        try {
            recalculateAndSetState(events, selectedSocio);
            setStatus('calculated');
            toast({
                title: 'Cálculo Realizado!',
                description: 'Os valores foram recalculados e salvos.'
            });
            
            await handleSave(true);

        } catch (error) {
            console.error("Erro no cálculo do RCI:", error);
            toast({
                variant: 'destructive',
                title: 'Erro no cálculo',
                description: (error as Error).message,
            })
        } finally {
            setIsCalculating(false);
        }
    };
    
    const { totalProventos, totalDescontos, liquido } = useMemo<RciTotals>(() => {
        if (!calculationResult) return { totalProventos: 0, totalDescontos: 0, liquido: 0 };
        return {
            totalProventos: calculationResult.totalProventos,
            totalDescontos: calculationResult.totalDescontos,
            liquido: calculationResult.liquido
        }
    }, [calculationResult]);
    
    const handleSave = async (isCalculation: boolean = false) => {
        if (!user || !activeCompany || !selectedSocio || !period) {
            toast({ variant: 'destructive', title: 'Dados incompletos', description: 'Selecione sócio e período para salvar.' });
            return;
        }

        setIsSaving(true);
        
        const calcResult = recalculateAndSetState(events, selectedSocio);
        if (!calcResult) {
            setIsSaving(false);
            return;
        }

        const finalStatus = isCalculation ? 'calculated' : 'draft';

        const rciData: Omit<RCI, 'id' | 'createdAt'> = {
            socioId: selectedSocio.id!,
            socioName: selectedSocio.nomeCompleto,
            period,
            status: finalStatus,
            events: events.filter(e => !['inss', 'irrf'].includes(e.rubrica.id!)),
            totals: { totalProventos: calcResult.totalProventos, totalDescontos: calcResult.totalDescontos, liquido: calcResult.liquido },
            baseINSS: calcResult.baseINSS,
            baseIRRF: calcResult.baseIRRF,
            updatedAt: serverTimestamp(),
        };

        try {
            if (currentRciId) {
                const rciRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/rcis`, currentRciId);
                await setDoc(rciRef, { ...rciData, updatedAt: serverTimestamp() }, { merge: true });
                if (!isCalculation) {
                    toast({ title: `RCI atualizado como Rascunho!` });
                }
            } else {
                const rcisRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/rcis`);
                const docRef = await addDoc(rcisRef, { ...rciData, createdAt: serverTimestamp() });
                setCurrentRciId(docRef.id);
                router.replace(`/pessoal/rci?id=${docRef.id}`, { scroll: false });
                if (!isCalculation) {
                  toast({ title: `RCI salvo como Rascunho!` });
                }
            }
            setStatus(finalStatus);
        } catch (error) {
            console.error("Erro ao salvar RCI:", error);
            toast({ variant: 'destructive', title: 'Erro ao salvar RCI' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!currentRciId || !user || !activeCompany) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/rcis`, currentRciId));
            toast({ title: 'Rascunho de RCI excluído com sucesso!' });
            router.push('/pessoal');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao excluir rascunho.' });
        }
    };

    const handleGeneratePdf = () => {
        if (!activeCompany || !selectedSocio || !calculationResult) {
            toast({ variant: 'destructive', title: 'Dados incompletos para gerar PDF.' });
            return;
        }

        const rciData: RCI = {
            id: currentRciId || undefined,
            socioId: selectedSocio.id!,
            socioName: selectedSocio.nomeCompleto,
            period,
            status,
            events, 
            totals: calculationResult,
            baseINSS: calculationResult.baseINSS,
            baseIRRF: calculationResult.baseIRRF,
            updatedAt: new Date(),
        };
        generateProLaboreReceiptPdf(activeCompany, selectedSocio, rciData);
    };

    const isEventRemovable = (eventId: string) => {
        return !['pro_labore', 'inss', 'irrf'].includes(eventId);
    };

    const isFieldEditable = (event: RciEvent): boolean => {
      // Allow editing unless it's a core system-calculated event
      return !['pro_labore', 'inss', 'irrf'].includes(event.id);
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

    const formatNumberForDisplay = (num?: number, options?: Intl.NumberFormatOptions) => {
        if (num === undefined || num === null || isNaN(num)) return '0,00';
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
                    <h1 className="text-2xl font-bold">Cálculo de RCI (Pró-labore)</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving || !selectedSocio || isCalculating}>
                        {isSaving && !isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                        Salvar Rascunho
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button variant="destructive" disabled={!currentRciId}><Trash2 className="mr-2 h-4 w-4"/> Excluir</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O rascunho do RCI será permanentemente removido.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={handleCalculate} disabled={isCalculating || !selectedSocio}>
                        {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Calculator className="mr-2 h-4 w-4"/>}
                        Calcular e Salvar
                    </Button>
                     <Button variant="secondary" onClick={handleGeneratePdf} disabled={status !== 'calculated' && status !== 'finalized'}>
                        <Printer className="mr-2 h-4 w-4" />
                        Visualizar Recibo
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Sócio</label>
                            <div className="relative">
                                <Input
                                    placeholder="Selecione um sócio"
                                    className="pr-10"
                                    readOnly
                                    value={selectedSocio ? selectedSocio.nomeCompleto : ''}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                    onClick={() => setIsSocioModalOpen(true)}
                                    disabled={!activeCompany || !!currentRciId}
                                    title={currentRciId ? "Não é possível alterar o sócio de um rascunho salvo." : "Selecionar sócio"}
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
                            <Button variant="outline" size="sm" onClick={() => setIsRubricaModalOpen(true)} disabled={!activeCompany || !selectedSocio}><Plus className="mr-2 h-4 w-4"/> Adicionar Evento</Button>
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
                                {!selectedSocio ? (
                                    <TableRow>
                                        <TableCell colSpan={9}>
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="p-4 bg-muted rounded-full mb-4">
                                                    <Search className="h-10 w-10 text-muted-foreground" />
                                                </div>
                                                <h3 className="text-xl font-semibold">Selecione um sócio</h3>
                                                <p className="text-muted-foreground mt-2">Use o botão de busca para escolher um sócio e iniciar o cálculo.</p>
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
                                ) : events.map((event, index) => (
                                    <TableRow key={`${event.id}-${index}`}>
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
                <SocioSelectionModal
                    isOpen={isSocioModalOpen}
                    onClose={() => setIsSocioModalOpen(false)}
                    onSelect={handleSelectSocio}
                    userId={user.uid}
                    companyId={activeCompany.id}
                />
            )}
        </div>
    );
}
