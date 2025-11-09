
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Loader2, ChevronLeft, ChevronRight, ArrowUpRightSquare, ArrowLeft, CheckCircle, Hourglass, Wallet, Banknote, AlertTriangle, Search, FilterX, FileText, FileSpreadsheet } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Launch } from '@/app/(app)/fiscal/page';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import * as XLSX from 'xlsx';
import { generateReceivablesReportPdf } from '@/services/receivables-report-service';
import { DateRangePicker } from '@/components/ui/date-range-picker';

type FinancialStatus = 'pendente' | 'pago' | 'vencido';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const getPartnerName = (launch: Launch): string => {
    switch (launch.type) {
      case 'saida':
        return launch.destinatario?.nome || 'N/A';
      case 'servico':
        return launch.tomador?.nome || 'N/A';
      default:
        return 'N/A';
    }
};

const getStatusLabel = (status?: FinancialStatus): string => {
    if (!status) return 'Pendente';
    return status.charAt(0).toUpperCase() + status.slice(1);
};


export default function ContasAReceberPage() {
  const [allLaunches, setAllLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);

  // Filter states
  const [filterPartner, setFilterPartner] = useState("");
  const [filterStatus, setFilterStatus] = useState<FinancialStatus | "">("");
  const [filterDate, setFilterDate] = useState<DateRange | undefined>(undefined);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
            setLoading(false);
        }
    }
  }, [user]);
  
  useEffect(() => {
    if (!user || !activeCompany) {
        setLoading(false);
        setAllLaunches([]);
        return;
    };

    setLoading(true);
    
    const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/launches`);
    const qLaunches = query(launchesRef, orderBy('date', 'desc'));

    const unsubscribeLaunches = onSnapshot(qLaunches, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date.toDate(),
        } as Launch));
        setAllLaunches(data);
        setLoading(false);
    }, (error) => { console.error("Error fetching launches: ", error); toast({ variant: "destructive", title: "Erro ao buscar lançamentos fiscais" }); setLoading(false); });


    return () => {
        unsubscribeLaunches();
    }
  }, [user, activeCompany, toast]);

  const launches = useMemo(() => allLaunches.filter(l => l.type === 'saida' || l.type === 'servico'), [allLaunches]);

   const filteredLaunches = useMemo(() => {
    return launches.filter(launch => {
        const partnerName = getPartnerName(launch).toLowerCase();
        const partnerMatch = filterPartner ? partnerName.includes(filterPartner.toLowerCase()) : true;

        const statusMatch = filterStatus ? (launch.financialStatus || 'pendente') === filterStatus : true;
        
        let dateMatch = true;
        if (filterDate?.from) {
            const launchDate = new Date(launch.date);
            launchDate.setHours(0,0,0,0);
            const startDate = new Date(filterDate.from);
            startDate.setHours(0,0,0,0);
            dateMatch = launchDate >= startDate;
        }
        if (filterDate?.to && dateMatch) {
            const launchDate = new Date(launch.date);
            launchDate.setHours(23,59,59,999);
            const endDate = new Date(filterDate.to);
            endDate.setHours(23,59,59,999);
            dateMatch = launchDate <= endDate;
        }

        return partnerMatch && statusMatch && dateMatch;
    });
  }, [launches, filterPartner, filterStatus, filterDate]);

  const financialTotals = useMemo(() => {
    return filteredLaunches.reduce((acc, launch) => {
        const value = launch.valorLiquido || launch.valorTotalNota || 0;
        const status = launch.financialStatus || 'pendente';
        acc[status] = (acc[status] || 0) + value;
        return acc;
    }, {} as Record<FinancialStatus, number>);
  }, [filteredLaunches]);

  const handleUpdateStatus = async (id: string, status: FinancialStatus) => {
     if (!user || !activeCompany) return;
    try {
      const docRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/launches`, id)
      await updateDoc(docRef, { financialStatus: status });
      toast({ title: 'Status financeiro atualizado!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar status' });
    }
  }


  const clearFilters = () => {
    setFilterPartner("");
    setFilterStatus("");
    setFilterDate(undefined);
  }

  const getStatusVariant = (status?: FinancialStatus) => {
    switch (status) {
        case 'pendente': return 'default';
        case 'pago': return 'success';
        case 'vencido': return 'destructive';
        default: return 'outline';
    }
  }
  
  const handleExportExcel = () => {
    if (filteredLaunches.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhum dado para exportar.' });
        return;
    }

    const dataToExport = filteredLaunches.map(launch => ({
        'Data': format(launch.date, 'dd/MM/yyyy'),
        'Parceiro (Cliente)': getPartnerName(launch),
        'Nota Fiscal': launch.chaveNfe || launch.numeroNfse,
        'Valor': launch.valorLiquido || launch.valorTotalNota || 0,
        'Status': getStatusLabel(launch.financialStatus as FinancialStatus),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contas a Receber");

    // Formatação de colunas (largura)
    worksheet['!cols'] = [
        { wch: 12 }, // Data
        { wch: 40 }, // Parceiro
        { wch: 45 }, // Nota Fiscal
        { wch: 15 }, // Valor
        { wch: 15 }, // Status
    ];

    XLSX.writeFile(workbook, `contas_a_receber_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  }
  
  const handleGeneratePdf = async () => {
     if (!user || !activeCompany) {
        toast({ variant: 'destructive', title: 'Usuário ou empresa não identificados.' });
        return;
    }
    
    try {
        await generateReceivablesReportPdf(user.uid, activeCompany, {
            from: filterDate?.from,
            to: filterDate?.to,
        }, filterStatus || undefined);
    } catch(error) {
        toast({
            variant: 'destructive',
            title: 'Erro ao gerar PDF',
            description: (error as Error).message,
        });
    }
  }


  const totalPages = Math.ceil(filteredLaunches.length / itemsPerPage);
  const paginatedLaunches = filteredLaunches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/financeiro">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Voltar</span>
                </Link>
            </Button>
            <h1 className="text-2xl font-bold">Contas a Receber</h1>
        </div>
      </div>

       <Card>
        <CardHeader className="flex-row justify-between items-start">
            <div>
                <CardTitle>Resumo Financeiro a Receber</CardTitle>
                <CardDescription>Visualize o status atual das suas contas a receber com base nos filtros aplicados.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleGeneratePdf} disabled={loading || filteredLaunches.length === 0}>
                    <FileText className="mr-2 h-4 w-4" />
                    Gerar PDF
                </Button>
                 <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={loading || filteredLaunches.length === 0}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar Excel
                </Button>
            </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">A Receber</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(financialTotals.pendente || 0)}</div>
                    <p className="text-xs text-muted-foreground">Total de notas com pagamento pendente.</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Recebido</CardTitle>
                    <Banknote className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(financialTotals.pago || 0)}</div>
                    <p className="text-xs text-muted-foreground">Total de notas pagas e confirmadas.</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Vencido</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(financialTotals.vencido || 0)}</div>
                     <p className="text-xs text-muted-foreground">Total de notas com pagamento atrasado.</p>
                </CardContent>
            </Card>
        </CardContent>
       </Card>

       <Card>
        <CardHeader>
          <CardTitle>Lançamentos a Receber</CardTitle>
          <CardDescription>Visualize as notas fiscais de venda e serviço pendentes de pagamento.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50 items-center">
                 <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filtrar por cliente..."
                        value={filterPartner}
                        onChange={(e) => setFilterPartner(e.target.value)}
                        className="pl-8"
                    />
                </div>
                 <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar por Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="vencido">Vencido</SelectItem>
                    </SelectContent>
                </Select>
                <DateRangePicker date={filterDate} onDateChange={setFilterDate} />
                <Button variant="ghost" onClick={clearFilters} className="sm:ml-auto">
                    <FilterX className="mr-2 h-4 w-4" />
                    Limpar Filtros
                </Button>
            </div>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : launches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                  <ArrowUpRightSquare className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhuma nota a receber encontrada</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                {!activeCompany ? "Selecione uma empresa para começar." : 'Lance notas fiscais de saída ou serviço no Módulo Fiscal para que elas apareçam aqui.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Parceiro (Cliente)</TableHead>
                  <TableHead>Nota Fiscal</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status Pagamento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLaunches.map((launch) => (
                  <TableRow key={launch.id}>
                    <TableCell className="font-mono">{format(launch.date, 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium">{getPartnerName(launch)}</TableCell>
                    <TableCell className="font-mono text-xs">{launch.chaveNfe || launch.numeroNfse}</TableCell>
                    <TableCell className="font-mono">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(launch.valorLiquido || launch.valorTotalNota || 0)}
                    </TableCell>
                    <TableCell>
                        <Badge variant={getStatusVariant(launch.financialStatus as FinancialStatus)} className="capitalize">{getStatusLabel(launch.financialStatus as FinancialStatus)}</Badge>
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
                             <DropdownMenuItem onClick={() => handleUpdateStatus(launch.id!, 'pago')} disabled={launch.financialStatus === 'pago'}>
                                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                Marcar como Pago
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleUpdateStatus(launch.id!, 'pendente')} disabled={!launch.financialStatus || launch.financialStatus === 'pendente'}>
                                <Hourglass className="mr-2 h-4 w-4 text-yellow-500" />
                                Marcar como Pendente
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex justify-end items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                </Button>
                <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
