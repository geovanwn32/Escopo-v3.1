
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
import { Users, ClipboardList, BookCheck, Gift, SendToBack, UserMinus, Loader2, ListChecks, MoreHorizontal, Eye, Trash2, FileX, Search, FilterX, Calendar as CalendarIcon } from "lucide-react";
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
import { format } from "date-fns";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";


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

  // Vacation Filters
  const [vacationNameFilter, setVacationNameFilter] = useState('');
  const [vacationStartDateFilter, setVacationStartDateFilter] = useState<Date | undefined>();
  const [vacationEndDateFilter, setVacationEndDateFilter] = useState<Date | undefined>();

  // Thirteenth Filters
  const [thirteenthNameFilter, setThirteenthNameFilter] = useState('');
  const [thirteenthYearFilter, setThirteenthYearFilter] = useState('');
  const [thirteenthParcelFilter, setThirteenthParcelFilter] = useState('');

  // Termination Filters
  const [terminationNameFilter, setTerminationNameFilter] = useState('');
  const [terminationStartDateFilter, setTerminationStartDateFilter] = useState<Date | undefined>();
  const [terminationEndDateFilter, setTerminationEndDateFilter] = useState<Date | undefined>();

  // RCI Filters
  const [rciNameFilter, setRciNameFilter] = useState('');
  const [rciPeriodFilter, setRciPeriodFilter] = useState('');
  const [rciStatusFilter, setRciStatusFilter] = useState('');


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
    };

    setLoading(true);
    
    const fetchAllData = async () => {
        try {
            const companyPath = `users/${user.uid}/companies/${activeCompany.id}`;
            const [
                payrollsSnap,
                rcisSnap,
                terminationsSnap,
                thirteenthsSnap,
                vacationsSnap
            ] = await Promise.all([
                getDocs(query(collection(db, `${companyPath}/payrolls`), orderBy('createdAt', 'desc'))),
                getDocs(query(collection(db, `${companyPath}/rcis`), orderBy('createdAt', 'desc'))),
                getDocs(query(collection(db, `${companyPath}/terminations`), orderBy('createdAt', 'desc'))),
                getDocs(query(collection(db, `${companyPath}/thirteenths`), orderBy('createdAt', 'desc'))),
                getDocs(query(collection(db, `${companyPath}/vacations`), orderBy('createdAt', 'desc')))
            ]);

            setPayrolls(payrollsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: (doc.data().createdAt as Timestamp)?.toDate() } as Payroll)));
            setRcis(rcisSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: (doc.data().createdAt as Timestamp)?.toDate() } as RCI)));
            setTerminations(terminationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), terminationDate: (doc.data().terminationDate as Timestamp)?.toDate() } as Termination)));
            setThirteenths(thirteenthsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Thirteenth)));
            setVacations(vacationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), startDate: (doc.data().startDate as Timestamp)?.toDate() } as Vacation)));
            
        } catch (error) {
            console.error("Error fetching pessoal data:", error);
            toast({ variant: "destructive", title: "Erro ao carregar dados do módulo pessoal." });
        } finally {
            setLoading(false);
        }
    };

    fetchAllData();
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
            if (vacationStartDateFilter) {
                const itemDate = new Date(v.startDate as Date);
                itemDate.setHours(0,0,0,0);
                const startDate = new Date(vacationStartDateFilter);
                startDate.setHours(0,0,0,0);
                dateMatch = itemDate >= startDate;
            }
            if (vacationEndDateFilter && dateMatch) {
                const itemDate = new Date(v.startDate as Date);
                itemDate.setHours(23,59,59,999);
                const endDate = new Date(vacationEndDateFilter);
                endDate.setHours(23,59,59,999);
                dateMatch = itemDate <= endDate;
            }
            return nameMatch && dateMatch;
        });
    }, [vacations, vacationNameFilter, vacationStartDateFilter, vacationEndDateFilter]);

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
            if (terminationStartDateFilter) {
                const itemDate = new Date(t.terminationDate as Date);
                itemDate.setHours(0,0,0,0);
                const startDate = new Date(terminationStartDateFilter);
                startDate.setHours(0,0,0,0);
                dateMatch = itemDate >= startDate;
            }
            if (terminationEndDateFilter && dateMatch) {
                const itemDate = new Date(t.terminationDate as Date);
                itemDate.setHours(23,59,59,999);
                const endDate = new Date(terminationEndDateFilter);
                endDate.setHours(23,59,59,999);
                dateMatch = itemDate <= endDate;
            }
            return nameMatch && dateMatch;
        });
    }, [terminations, terminationNameFilter, terminationStartDateFilter, terminationEndDateFilter]);

  const handleDeleteGeneric = async (collectionName: string, docId: string, docName: string) => {
      if (!user || !activeCompany) return;
      try {
        await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/${collectionName}`, docId));
        toast({ title: `${docName} excluído(a) com sucesso!` });
        // Refetch data after deletion
        if (collectionName === 'payrolls') setPayrolls(prev => prev.filter(p => p.id !== docId));
        if (collectionName === 'rcis') setRcis(prev => prev.filter(p => p.id !== docId));
        if (collectionName === 'terminations') setTerminations(prev => prev.filter(p => p.id !== docId));
        if (collectionName === 'thirteenths') setThirteenths(prev => prev.filter(p => p.id !== docId));
        if (collectionName === 'vacations') setVacations(prev => prev.filter(p => p.id !== docId));

      } catch (error) {
        toast({ variant: 'destructive', title: `Erro ao excluir ${docName}.` });
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
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
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
                <span><ClipboardList className="mr-2 h-4 w-4" />Calcular RCI</span>
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Relatórios</CardTitle>
            <CardDescription>Gere relatórios importantes do departamento pessoal.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="w-full justify-start">
              <Link href="/pessoal/resumo-folha">
                <span><BookCheck className="mr-2 h-4 w-4" />Resumo da Folha</span>
              </Link>
            </Button>
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
          <CardTitle>RCIs (Pró-labore) Salvos</CardTitle>
          <CardDescription>Visualize os cálculos de pró-labore dos sócios.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50">
                <Input placeholder="Filtrar por nome..." value={rciNameFilter} onChange={(e) => setRciNameFilter(e.target.value)} className="max-w-xs" />
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
                  <ListChecks className="h-10 w-10 text-muted-foreground" />
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
                                        <AlertDialogAction onClick={() => handleDeleteGeneric('rcis', rci.id!, 'RCI')} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
             <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50">
                <Input placeholder="Filtrar por nome..." value={vacationNameFilter} onChange={(e) => setVacationNameFilter(e.target.value)} className="max-w-xs" />
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant={"outline"} className="w-full sm:w-[280px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {vacationStartDateFilter && vacationEndDateFilter ? (<>{format(vacationStartDateFilter, "dd/MM/yy")} - {format(vacationEndDateFilter, "dd/MM/yy")}</>) : <span>Filtrar por Data de Início</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="range" selected={{ from: vacationStartDateFilter, to: vacationEndDateFilter }} onSelect={(range) => { setVacationStartDateFilter(range?.from); setVacationEndDateFilter(range?.to); }} locale={ptBR} numberOfMonths={2} />
                    </PopoverContent>
                </Popover>
                <Button variant="ghost" onClick={() => { setVacationNameFilter(''); setVacationStartDateFilter(undefined); setVacationEndDateFilter(undefined); }} className="sm:ml-auto">
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
            <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50">
                <Input placeholder="Filtrar por nome..." value={terminationNameFilter} onChange={(e) => setTerminationNameFilter(e.target.value)} className="max-w-xs" />
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant={"outline"} className="w-full sm:w-[280px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {terminationStartDateFilter && terminationEndDateFilter ? (<>{format(terminationStartDateFilter, "dd/MM/yy")} - {format(terminationEndDateFilter, "dd/MM/yy")}</>) : <span>Filtrar por Data de Afastamento</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="range" selected={{ from: terminationStartDateFilter, to: terminationEndDateFilter }} onSelect={(range) => { setTerminationStartDateFilter(range?.from); setTerminationEndDateFilter(range?.to); }} locale={ptBR} numberOfMonths={2} />
                    </PopoverContent>
                </Popover>
                <Button variant="ghost" onClick={() => { setTerminationNameFilter(''); setTerminationStartDateFilter(undefined); setTerminationEndDateFilter(undefined); }} className="sm:ml-auto">
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
