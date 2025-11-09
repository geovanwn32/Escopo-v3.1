
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Search, FilterX, FileText, FileSpreadsheet, ArrowUp, ArrowDown, Scale } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Launch } from '@/app/(app)/fiscal/page';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import * as XLSX from 'xlsx';
import { generateCashFlowReportPdf } from '@/services/cash-flow-report-service';
import { DateRangePicker } from '@/components/ui/date-range-picker';


const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function FluxoDeCaixaPage() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);

  // Filter states
  const [filterPartner, setFilterPartner] = useState("");
  const [filterType, setFilterType] = useState<"entrada" | "saida" | "">("");
  const [filterDate, setFilterDate] = useState<DateRange | undefined>(undefined);

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
        setLaunches([]);
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
        setLaunches(data);
        setLoading(false);
    }, (error) => { console.error("Error fetching launches: ", error); toast({ variant: "destructive", title: "Erro ao buscar lançamentos fiscais" }); setLoading(false); });


    return () => {
        unsubscribeLaunches();
    }
  }, [user, activeCompany, toast]);

  const getPartnerName = (launch: Launch): string => {
    switch (launch.type) {
      case 'saida': return launch.destinatario?.nome || 'N/A';
      case 'servico': return launch.tomador?.nome || 'N/A';
      case 'entrada': return launch.emitente?.nome || 'N/A';
      default: return 'N/A';
    }
  };

   const filteredLaunches = useMemo(() => {
    return launches.filter(launch => {
        const partnerName = getPartnerName(launch).toLowerCase();
        const partnerMatch = filterPartner ? partnerName.includes(filterPartner.toLowerCase()) : true;

        let typeMatch = true;
        if (filterType === 'entrada') {
            typeMatch = launch.type === 'entrada';
        } else if (filterType === 'saida') {
            typeMatch = launch.type === 'saida' || launch.type === 'servico';
        }
        
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
            launchDate.setHours(0,0,0,0);
            const endDate = new Date(filterDate.to);
            endDate.setHours(0,0,0,0);
            dateMatch = launchDate <= endDate;
        }

        return partnerMatch && typeMatch && dateMatch;
    });
  }, [launches, filterPartner, filterType, filterDate]);
  
  const financialTotals = useMemo(() => {
    return filteredLaunches.reduce((acc, launch) => {
        const value = launch.valorLiquido || launch.valorTotalNota || 0;
        if (launch.type === 'saida' || launch.type === 'servico') {
            acc.entradas += value;
        } else if (launch.type === 'entrada') {
            acc.saidas += value;
        }
        return acc;
    }, { entradas: 0, saidas: 0 });
  }, [filteredLaunches]);


  const clearFilters = () => {
    setFilterPartner("");
    setFilterType("");
    setFilterDate(undefined);
  }

  const getTypeVariant = (type?: Launch['type']) => {
    switch (type) {
        case 'entrada': return 'destructive';
        case 'saida':
        case 'servico': return 'success';
        default: return 'outline';
    }
  }
   const getTypeLabel = (type?: Launch['type']): string => {
     switch (type) {
        case 'entrada': return 'Saída de Caixa';
        case 'saida': return 'Entrada de Caixa';
        case 'servico': return 'Entrada de Caixa';
        default: return 'N/A';
    }
  };

  const handleExportExcel = () => {
    if (filteredLaunches.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhum dado para exportar.' });
        return;
    }

    const dataToExport = filteredLaunches.map(launch => ({
        'Data': format(launch.date, 'dd/MM/yyyy'),
        'Parceiro': getPartnerName(launch),
        'Tipo': getTypeLabel(launch.type),
        'Valor': (launch.type === 'entrada' ? -1 : 1) * (launch.valorLiquido || launch.valorTotalNota || 0),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "FluxoDeCaixa");

    worksheet['!cols'] = [ { wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 15 } ];
    XLSX.writeFile(workbook, `fluxo_de_caixa_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  }
  
  const handleGeneratePdf = () => {
    if (!activeCompany) return;
    if (filteredLaunches.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhum dado para exportar.' });
        return;
    }
    generateCashFlowReportPdf(activeCompany, filteredLaunches, financialTotals, filterDate);
  }


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
            <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
        </div>
      </div>

       <Card>
        <CardHeader className="flex-row justify-between items-start">
            <div>
                <CardTitle>Resumo de Caixa do Período</CardTitle>
                <CardDescription>Visualize as entradas e saídas com base nos filtros aplicados.</CardDescription>
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
                    <CardTitle className="text-sm font-medium">Entradas</CardTitle>
                    <ArrowUp className="h-4 w-4 text-green-600"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(financialTotals.entradas)}</div>
                    <p className="text-xs text-muted-foreground">Total de recebimentos no período.</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saídas</CardTitle>
                    <ArrowDown className="h-4 w-4 text-red-600"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(financialTotals.saidas)}</div>
                     <p className="text-xs text-muted-foreground">Total de pagamentos no período.</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saldo do Período</CardTitle>
                    <Scale className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className={cn(
                        "text-2xl font-bold",
                        (financialTotals.entradas - financialTotals.saidas) >= 0 ? "text-blue-600" : "text-destructive"
                    )}>{formatCurrency(financialTotals.entradas - financialTotals.saidas)}</div>
                    <p className="text-xs text-muted-foreground">Resultado de entradas menos saídas.</p>
                </CardContent>
            </Card>
        </CardContent>
       </Card>

       <Card>
        <CardHeader>
          <CardTitle>Movimentações de Caixa</CardTitle>
          <CardDescription>Visualize todas as movimentações financeiras do período.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50 items-center">
                 <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filtrar por parceiro..."
                        value={filterPartner}
                        onChange={(e) => setFilterPartner(e.target.value)}
                        className="pl-8"
                    />
                </div>
                 <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar por Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="saida">Entrada de Caixa</SelectItem>
                        <SelectItem value="entrada">Saída de Caixa</SelectItem>
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
                  <Scale className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhuma movimentação encontrada</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                {!activeCompany ? "Selecione uma empresa para começar." : 'Lance notas fiscais no Módulo Fiscal para que elas apareçam aqui.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLaunches.map((launch) => (
                  <TableRow key={launch.id}>
                    <TableCell className="font-mono">{format(launch.date, 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium">{getPartnerName(launch)}</TableCell>
                    <TableCell>
                        <Badge variant={getTypeVariant(launch.type)}>{getTypeLabel(launch.type)}</Badge>
                    </TableCell>
                    <TableCell className={cn(
                        "text-right font-mono font-semibold",
                        (launch.type === 'saida' || launch.type === 'servico') ? "text-green-600" : "text-red-600"
                    )}>
                      {formatCurrency(launch.valorLiquido || launch.valorTotalNota || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredLaunches.length > 0 && (
             <CardFooter className="justify-end">
                <p className="text-xs text-muted-foreground">Exibindo {filteredLaunches.length} de {launches.length} movimentações.</p>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
