
"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp, doc, deleteDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { Company } from '@/types/company';
import type { Payroll } from "@/types/payroll";
import type { Termination } from "@/types/termination";
import type { Thirteenth } from "@/types/thirteenth";
import type { Vacation } from "@/types/vacation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ClipboardList, BookCheck, Gift, SendToBack, UserMinus, Loader2, ListChecks, MoreHorizontal, Eye, Trash2, FileX, Search, FilterX, Calendar as CalendarIcon, FileText, Printer, BarChart as BarChartIcon } from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { RCI } from "@/types/rci";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { format, isValid, subMonths } from "date-fns";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { generateProLaboreReceiptPdf } from "@/services/pro-labore-receipt-service";
import type { Socio } from "@/types/socio";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { startOfMonth, endOfMonth } from 'date-fns';

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function PessoalPageWrapper() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [rcis, setRcis] = useState<RCI[]>([]);
  const [terminations, setTerminations] = useState<Termination[]>([]);
  const [thirteenths, setThirteenths] = useState<Thirteenth[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  
  // Payroll Filters
  const [payrollNameFilter, setPayrollNameFilter] = useState('');
  const [payrollPeriodFilter, setPayrollPeriodFilter] = useState('');
  const [payrollStatusFilter, setPayrollStatusFilter] = useState('');

  // RCI Filters
  const [rciNameFilter, setRciNameFilter] = useState('');
  const [rciPeriodFilter, setRciPeriodFilter] = useState('');
  const [rciStatusFilter, setRciStatusFilter] = useState('');

  // Vacation Filters
  const [vacationNameFilter, setVacationNameFilter] = useState('');
  const [vacationDateFilter, setVacationDateFilter] = useState<DateRange | undefined>();

  // Thirteenth Filters
  const [thirteenthNameFilter, setThirteenthNameFilter] = useState('');
  const [thirteenthYearFilter, setThirteenthYearFilter] = useState('');
  const [thirteenthParcelFilter, setThirteenthParcelFilter] = useState('');

  // Termination Filters
  const [terminationDateFilter, setTerminationDateFilter] = useState<DateRange | undefined>();
  const [terminationNameFilter, setTerminationNameFilter] = useState('');

  const { user } = useAuth();
  const { toast } = useToast();

   useEffect(() => {
    if (typeof window !== 'undefined') {
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (user && companyId) {
            const companyDataString = sessionStorage.getItem(`company_${companyId}`);
            if (companyDataString) {
                setActiveCompany(JSON.parse(companyDataString));
            } else {
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    }
  }, [user]);

   useEffect(() => {
    if (!user || !activeCompany) {
        setLoading(false);
        setPayrolls([]);
        setRcis([]);
        setTerminations([]);
        setThirteenths([]);
        setVacations([]);
        return;
    }

    setLoading(true);
    const companyPath = `users/${user.uid}/companies/${activeCompany.id}`;
    
    const collectionsToListen = [
        { name: 'payrolls', setter: setPayrolls },
        { name: 'rcis', setter: setRcis },
        { name: 'terminations', setter: setTerminations },
        { name: 'thirteenths', setter: setThirteenths },
        { name: 'vacations', setter: setVacations },
    ];
    
    let listenersInitialized = 0;

    const unsubscribes = collectionsToListen.map(({ name, setter }) => {
        const q = query(collection(db, `${companyPath}/${name}`), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const docData = doc.data();
                // Safely convert all Timestamps to Dates
                Object.keys(docData).forEach(key => {
                    if (docData[key] instanceof Timestamp) {
                        docData[key] = docData[key].toDate();
                    }
                });
                return { id: doc.id, ...docData };
            });
            setter(data as any);
            
            listenersInitialized++;
            if (listenersInitialized === collectionsToListen.length) {
                setLoading(false);
            }
        }, (error) => {
            console.error(`Error fetching ${name}:`, error);
            toast({ variant: "destructive", title: `Erro ao buscar ${name}.` });
            listenersInitialized++;
            if (listenersInitialized === collectionsToListen.length) {
                setLoading(false);
            }
        });
    });
    
    return () => {
        unsubscribes.forEach(unsub => unsub());
    }

  }, [user, activeCompany, toast]);

    const filteredPayrolls = useMemo(() => {
        return payrolls.filter(p =>
            p.employeeName.toLowerCase().includes(payrollNameFilter.toLowerCase()) &&
            p.period.includes(payrollPeriodFilter) &&
            (payrollStatusFilter ? p.status === payrollStatusFilter : true)
        );
    }, [payrolls, payrollNameFilter, payrollPeriodFilter, payrollStatusFilter]);

    const filteredRcis = useMemo(() => {
        return rcis.filter(r =>
            r.socioName.toLowerCase().includes(rciNameFilter.toLowerCase()) &&
            r.period.includes(rciPeriodFilter) &&
            (rciStatusFilter ? r.status === rciStatusFilter : true)
        );
    }, [rcis, rciNameFilter, rciPeriodFilter, rciStatusFilter]);

    const filteredVacations = useMemo(() => {
        return vacations.filter(v => {
            const nameMatch = v.employeeName.toLowerCase().includes(vacationNameFilter.toLowerCase());
            let dateMatch = true;
            if (vacationDateFilter?.from) {
                const itemDate = new Date(v.startDate as Date);
                itemDate.setHours(0,0,0,0);
                const startDate = new Date(vacationDateFilter.from);
                startDate.setHours(0,0,0,0);
                dateMatch = itemDate >= startDate;
            }
            if (vacationDateFilter?.to && dateMatch) {
                const itemDate = new Date(v.startDate as Date);
                itemDate.setHours(23,59,59,999);
                const endDate = new Date(vacationDateFilter.to);
                endDate.setHours(23,59,59,999);
                dateMatch = itemDate <= endDate;
            }
            return nameMatch && dateMatch;
        });
    }, [vacations, vacationNameFilter, vacationDateFilter]);

    const filteredThirteenths = useMemo(() => {
        return thirteenths.filter(t =>
            t.employeeName.toLowerCase().includes(thirteenthNameFilter.toLowerCase()) &&
            String(t.year).includes(thirteenthYearFilter) &&
            (thirteenthParcelFilter ? t.parcel === thirteenthParcelFilter : true)
        );
    }, [thirteenths, thirteenthNameFilter, thirteenthYearFilter, thirteenthParcelFilter]);
    
    const filteredTerminations = useMemo(() => {
        return terminations.filter(t => {
            const nameMatch = t.employeeName.toLowerCase().includes(terminationNameFilter.toLowerCase());
            let dateMatch = true;
            if (terminationDateFilter?.from) {
                const itemDate = new Date(t.terminationDate as Date);
                itemDate.setHours(0,0,0,0);
                const startDate = new Date(terminationDateFilter.from);
                startDate.setHours(0,0,0,0);
                dateMatch = itemDate >= startDate;
            }
            if (terminationDateFilter?.to && dateMatch) {
                const itemDate = new Date(t.terminationDate as Date);
                itemDate.setHours(23,59,59,999);
                const endDate = new Date(terminationDateFilter.to);
                endDate.setHours(23,59,59,999);
                dateMatch = itemDate <= endDate;
            }
            return nameMatch && dateMatch;
        });
    }, [terminations, terminationNameFilter, terminationDateFilter]);

    const monthlyCostData = useMemo(() => {
        const monthlyTotals: { [key: string]: { totalCost: number } } = {};
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            monthlyTotals[key] = { totalCost: 0 };
        }

        const allCosts = [...payrolls, ...rcis, ...vacations, ...thirteenths, ...terminations];

        allCosts.forEach(item => {
            let itemDate: Date | null = null;
            if ('period' in item && typeof item.period === 'string') {
                const [month, year] = item.period.split('/');
                itemDate = new Date(parseInt(year), parseInt(month) - 1, 15);
            } else if ('startDate' in item) { // Vacation
                itemDate = new Date(item.startDate as Date);
            } else if ('terminationDate' in item) { // Termination
                itemDate = new Date(item.terminationDate as Date);
            } else if ('createdAt' in item) { // Thirteenth (fallback)
                itemDate = new Date(item.createdAt as Date);
            }

            if (itemDate && isValid(itemDate)) {
                const key = `${itemDate.getFullYear()}-${itemDate.getMonth()}`;
                if (monthlyTotals[key]) {
                    const proventos = (item.totals || item.result)?.totalProventos || 0;
                    monthlyTotals[key].totalCost += proventos;
                }
            }
        });
        
        return Object.keys(monthlyTotals).map(key => {
            const [year, month] = key.split('-').map(Number);
            return { month: monthNames[month], ...monthlyTotals[key] };
        });
    }, [payrolls, rcis, vacations, thirteenths, terminations]);

  const handleDeleteGeneric = async (collectionName: string, docId: string, docName: string) => {
      if (!user || !activeCompany) return;
      try {
        await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/${collectionName}`, docId));
        toast({ title: `${docName} excluído(a) com sucesso!` });
      } catch (error) {
        toast({ variant: 'destructive', title: `Erro ao excluir ${docName}.` });
      }
  };

  const handleGenerateRciPdf = async (rci: RCI) => {
    if (!user || !activeCompany) return;
    try {
      const socioSnap = await getDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/socios`, rci.socioId));
      if (socioSnap.exists()) {
        const socioData = { id: socioSnap.id, ...socioSnap.data() } as Socio;
        generateProLaboreReceiptPdf(activeCompany, socioData, rci);
      } else {
        toast({ variant: "destructive", title: "Sócio não encontrado" });
      }
    } catch(e) {
      toast({ variant: "destructive", title: "Erro ao gerar PDF" });
    }
  };


  const getStatusVariant = (status: Payroll['status']): "secondary" | "default" | "outline" => {
    switch (status) {
        case 'draft': return 'secondary';
        case 'calculated': return 'default';
        case 'finalized': return 'outline'
        default: return 'secondary';
    }
  }

  const getStatusLabel = (status: Payroll['status']): string => {
    switch(status) {
        case 'draft': return 'Rascunho';
        case 'calculated': return 'Calculada';
        case 'finalized': return 'Finalizada';
        default: return status;
    }
  }

  const getParcelLabel = (parcel: string): string => {
    switch(parcel) {
        case 'first': return '1ª Parcela';
        case 'second': return '2ª Parcela';
        case 'unique': return 'Parcela Única';
        default: return parcel;
    }
  };


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Módulo Pessoal</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Cálculos e Processamentos</CardTitle>
            <CardDescription>Execute os principais cálculos da folha de pagamento.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="w-full justify-start">
              <Link href="/pessoal/folha-de-pagamento">
                <span><ClipboardList className="mr-2 h-4 w-4" />Calcular Folha de Pagamento</span>
              </Link>
            </Button>
            <Button asChild className="w-full justify-start bg-green-100 text-green-800 hover:bg-green-200">
              <Link href="/pessoal/rci">
                <span><FileText className="mr-2 h-4 w-4" />Calcular RCI (Pró-labore)</span>
              </Link>
            </Button>
            <Button asChild className="w-full justify-start bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
              <Link href="/pessoal/decimo-terceiro">
                <span><Gift className="mr-2 h-4 w-4" />Calcular 13º Salário</span>
              </Link>
            </Button>
            <Button asChild className="w-full justify-start bg-orange-100 text-orange-800 hover:bg-orange-200">
              <Link href="/pessoal/ferias">
                <span><SendToBack className="mr-2 h-4 w-4" />Calcular Férias</span>
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="destructive">
              <Link href="/pessoal/rescisao">
                <span><UserMinus className="mr-2 h-4 w-4" />Calcular Rescisão</span>
              </Link>
            </Button>
             <Button asChild className="w-full justify-start mt-4">
              <Link href="/pessoal/resumo-folha">
                <span><BookCheck className="mr-2 h-4 w-4" />Resumo da Folha</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
           <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChartIcon className="h-5 w-5 text-primary"/>Evolução de Custos com Pessoal</CardTitle>
            <CardDescription>Custo total (salários + encargos) nos últimos 6 meses.</CardDescription>
          </CardHeader>
           <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={monthlyCostData} >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value as number)} />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                            formatter={(value: number) => [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), "Custo Total"]}
                        />
                        <Bar dataKey="totalCost" fill="hsl(var(--primary))" name="Custo Total" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Folhas de Pagamento Salvas</CardTitle>
          <CardDescription>Visualize e continue os cálculos salvos.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50">
                <Input placeholder="Filtrar por nome..." value={payrollNameFilter} onChange={(e) => setPayrollNameFilter(e.target.value)} className="max-w-xs" />
                <Input placeholder="Filtrar por período..." value={payrollPeriodFilter} onChange={(e) => setPayrollPeriodFilter(e.target.value)} className="w-full sm:w-[180px]" />
                <Select value={payrollStatusFilter} onValueChange={setPayrollStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="calculated">Calculada</SelectItem>
                        <SelectItem value="finalized">Finalizada</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="ghost" onClick={() => { setPayrollNameFilter(''); setPayrollPeriodFilter(''); setPayrollStatusFilter(''); }} className="sm:ml-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Limpar Filtros
                </Button>
            </div>
           {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : payrolls.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                  <ListChecks className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhuma folha de pagamento salva</h3>
              <p className="text-muted-foreground mt-2">
                {activeCompany ? 'Crie uma nova folha para começar.' : 'Selecione uma empresa para visualizar as folhas salvas.'}
              </p>
            </div>
           ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayrolls.map((payroll) => (
                  <TableRow key={payroll.id}>
                    <TableCell className="font-medium">{payroll.employeeName}</TableCell>
                    <TableCell>{payroll.period}</TableCell>
                     <TableCell>
                      <Badge 
                        variant={getStatusVariant(payroll.status)} 
                        className={cn("capitalize", {
                            'bg-green-600 hover:bg-green-600/90 text-white': payroll.status === 'calculated',
                        })}
                      >
                         {getStatusLabel(payroll.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payroll.totals.liquido)}
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href={`/pessoal/folha-de-pagamento?id=${payroll.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Acessar
                                </Link>
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
                                            Esta ação não pode ser desfeita. A folha de pagamento será permanentemente removida.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteGeneric('payrolls', payroll.id!, 'Folha de Pagamento')} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
      
        <Card>
            <CardHeader>
            <CardTitle>Cálculos de Pró-labore (RCI) Salvos</CardTitle>
            <CardDescription>Visualize e continue os cálculos de pró-labore salvos.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50">
                    <Input placeholder="Filtrar por nome do sócio..." value={rciNameFilter} onChange={(e) => setRciNameFilter(e.target.value)} className="max-w-xs" />
                    <Input placeholder="Filtrar por período..." value={rciPeriodFilter} onChange={(e) => setRciPeriodFilter(e.target.value)} className="w-full sm:w-[180px]" />
                    <Select value={rciStatusFilter} onValueChange={setRciStatusFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="draft">Rascunho</SelectItem>
                            <SelectItem value="calculated">Calculada</SelectItem>
                            <SelectItem value="finalized">Finalizada</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="ghost" onClick={() => { setRciNameFilter(''); setRciPeriodFilter(''); setRciStatusFilter(''); }} className="sm:ml-auto">
                        <FilterX className="mr-2 h-4 w-4" /> Limpar Filtros
                    </Button>
                </div>
                {loading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                ) : rcis.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 bg-muted rounded-full mb-4">
                        <FileText className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">Nenhum RCI salvo</h3>
                    <p className="text-muted-foreground mt-2">
                    {activeCompany ? 'Crie um novo RCI para começar.' : 'Selecione uma empresa para visualizar os RCIs salvos.'}
                    </p>
                </div>
                ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Sócio</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Líquido</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRcis.map((rci) => (
                        <TableRow key={rci.id}>
                            <TableCell className="font-medium">{rci.socioName}</TableCell>
                            <TableCell>{rci.period}</TableCell>
                            <TableCell>
                            <Badge 
                                variant={getStatusVariant(rci.status)} 
                                className={cn("capitalize", {
                                    'bg-green-600 hover:bg-green-600/90 text-white': rci.status === 'calculated',
                                })}
                            >
                                {getStatusLabel(rci.status)}
                            </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rci.totals.liquido)}
                            </TableCell>
                            <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Abrir menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <Link href={`/pessoal/rci?id=${rci.id}`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Acessar
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleGenerateRciPdf(rci)}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Gerar Recibo
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
                                                Esta ação não pode ser desfeita. O RCI será permanentemente removido.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteGeneric('rcis', rci.id!, 'Cálculo de RCI')} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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

      <Card>
        <CardHeader>
          <CardTitle>Cálculos de 13º Salário Salvos</CardTitle>
          <CardDescription>Visualize os cálculos de 13º salário salvos.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50">
                <Input placeholder="Filtrar por nome..." value={thirteenthNameFilter} onChange={(e) => setThirteenthNameFilter(e.target.value)} className="max-w-xs" />
                <Input placeholder="Filtrar por ano..." value={thirteenthYearFilter} onChange={(e) => setThirteenthYearFilter(e.target.value)} className="w-full sm:w-[180px]" />
                <Select value={thirteenthParcelFilter} onValueChange={setThirteenthParcelFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por Parcela" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="first">1ª Parcela</SelectItem>
                        <SelectItem value="second">2ª Parcela</SelectItem>
                        <SelectItem value="unique">Parcela Única</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="ghost" onClick={() => { setThirteenthNameFilter(''); setThirteenthYearFilter(''); setThirteenthParcelFilter(''); }} className="sm:ml-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Limpar Filtros
                </Button>
            </div>
           {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : thirteenths.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                  <Gift className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhum cálculo de 13º salvo</h3>
              <p className="text-muted-foreground mt-2">
                {activeCompany ? 'Calcule um novo 13º para começar.' : 'Selecione uma empresa para visualizar os cálculos salvos.'}
              </p>
            </div>
           ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredThirteenths.map((thirteenth) => (
                  <TableRow key={thirteenth.id}>
                    <TableCell className="font-medium">{thirteenth.employeeName}</TableCell>
                    <TableCell>{thirteenth.year}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getParcelLabel(thirteenth.parcel)}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(thirteenth.result.liquido)}
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href={`/pessoal/decimo-terceiro?id=${thirteenth.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Acessar
                                </Link>
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
                                            Esta ação não pode ser desfeita. O cálculo será permanentemente removido.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteGeneric('thirteenths', thirteenth.id!, 'Cálculo de 13º')} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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

      <Card>
        <CardHeader>
          <CardTitle>Férias Salvas</CardTitle>
          <CardDescription>Visualize os cálculos de férias salvos.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50 items-center">
                <Input placeholder="Filtrar por nome..." value={vacationNameFilter} onChange={(e) => setVacationNameFilter(e.target.value)} className="max-w-xs" />
                <DateRangePicker date={vacationDateFilter} onDateChange={setVacationDateFilter} placeholder="Filtrar por Data de Início" />
                <Button variant="ghost" onClick={() => { setVacationNameFilter(''); setVacationDateFilter(undefined); }} className="sm:ml-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Limpar Filtros
                </Button>
            </div>
           {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : vacations.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                  <SendToBack className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhum cálculo de férias salvo</h3>
              <p className="text-muted-foreground mt-2">
                {activeCompany ? 'Calcule novas férias para começar.' : 'Selecione uma empresa para visualizar os cálculos salvos.'}
              </p>
            </div>
           ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data de Início</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVacations.map((vacation) => (
                  <TableRow key={vacation.id}>
                    <TableCell className="font-medium">{vacation.employeeName}</TableCell>
                    <TableCell>{new Intl.DateTimeFormat('pt-BR').format(vacation.startDate as Date)}</TableCell>
                    <TableCell>{vacation.vacationDays}</TableCell>
                    <TableCell className="text-right font-mono">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vacation.result.liquido)}
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href={`/pessoal/ferias?id=${vacation.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Acessar
                                </Link>
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
                                            Esta ação não pode ser desfeita. O cálculo de férias será permanentemente removido.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteGeneric('vacations', vacation.id!, 'Cálculo de Férias')} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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


      <Card>
        <CardHeader>
          <CardTitle>Rescisões Salvas</CardTitle>
          <CardDescription>Visualize os cálculos de rescisão salvos.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50 items-center">
                <Input placeholder="Filtrar por nome..." value={terminationNameFilter} onChange={(e) => setTerminationNameFilter(e.target.value)} className="max-w-xs" />
                <DateRangePicker date={terminationDateFilter} onDateChange={setTerminationDateFilter} placeholder="Filtrar por Data de Afastamento" />
                <Button variant="ghost" onClick={() => { setTerminationNameFilter(''); setTerminationDateFilter(undefined); }} className="sm:ml-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Limpar Filtros
                </Button>
            </div>
           {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : terminations.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                  <FileX className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhuma rescisão salva</h3>
              <p className="text-muted-foreground mt-2">
                {activeCompany ? 'Calcule uma nova rescisão para começar.' : 'Selecione uma empresa para visualizar as rescisões salvas.'}
              </p>
            </div>
           ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data de Afastamento</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTerminations.map((termination) => (
                  <TableRow key={termination.id}>
                    <TableCell className="font-medium">{termination.employeeName}</TableCell>
                    <TableCell>{new Intl.DateTimeFormat('pt-BR').format(termination.terminationDate as Date)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(termination.result.liquido)}
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href={`/pessoal/rescisao?id=${termination.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Acessar
                                </Link>
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
                                            Esta ação não pode ser desfeita. A rescisão será permanentemente removida.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteGeneric('terminations', termination.id!, 'Rescisão')} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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

    

    

    

