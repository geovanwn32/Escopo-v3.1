
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Loader2, ChevronLeft, ChevronRight, ArrowDownLeftSquare, ArrowLeft, CheckCircle, Hourglass, Wallet, Banknote, AlertTriangle } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Launch } from '@/app/(app)/fiscal/page';

type FinancialStatus = 'pendente' | 'pago' | 'vencido';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function ContasAPagarPage() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);

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
        setLaunches([]);
        return;
    };

    setLoading(true);
    
    const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/launches`);
    const qLaunches = query(launchesRef, 
        where('type', '==', 'entrada')
    );
    const unsubscribeLaunches = onSnapshot(qLaunches, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date.toDate(),
        } as Launch));
        // Sort data by date on the client-side
        data.sort((a, b) => b.date.getTime() - a.date.getTime());
        setLaunches(data);
        setLoading(false);
    }, (error) => { console.error("Error fetching launches: ", error); toast({ variant: "destructive", title: "Erro ao buscar lançamentos fiscais" }); setLoading(false); });


    return () => {
        unsubscribeLaunches();
    }
  }, [user, activeCompany, toast]);

  const financialTotals = useMemo(() => {
    return launches.reduce((acc, launch) => {
        const value = launch.valorTotalNota || 0;
        const status = launch.financialStatus || 'pendente';
        acc[status] = (acc[status] || 0) + value;
        return acc;
    }, {} as Record<FinancialStatus, number>);
  }, [launches]);


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

  const getPartnerName = (launch: Launch): string => {
    return launch.emitente?.nome || 'N/A';
  };

  const getStatusVariant = (status?: FinancialStatus) => {
    switch (status) {
        case 'pendente': return 'default';
        case 'pago': return 'success';
        case 'vencido': return 'destructive';
        default: return 'outline';
    }
  }
   const getStatusLabel = (status?: FinancialStatus): string => {
    if (!status) return 'Pendente';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };


  const totalPages = Math.ceil(launches.length / itemsPerPage);
  const paginatedLaunches = launches.slice(
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
            <h1 className="text-2xl font-bold">Contas a Pagar</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo Financeiro a Pagar</CardTitle>
          <CardDescription>Visualize o status atual das suas contas a pagar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(financialTotals.pendente || 0)}</div>
                    <p className="text-xs text-muted-foreground">Total de notas com pagamento pendente.</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pago (Últimos 30 dias)</CardTitle>
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
          <CardTitle>Lançamentos a Pagar</CardTitle>
          <CardDescription>Visualize as notas fiscais de compra (entradas) pendentes de pagamento.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : launches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                  <ArrowDownLeftSquare className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Nenhuma nota a pagar encontrada</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                {!activeCompany ? "Selecione uma empresa para começar." : 'Lance notas fiscais de entrada no Módulo Fiscal para que elas apareçam aqui.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Parceiro (Fornecedor)</TableHead>
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
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(launch.valorTotalNota || 0)}
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
