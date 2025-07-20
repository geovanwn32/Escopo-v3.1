
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { Company } from '@/app/(app)/fiscal/page';
import type { Payroll } from "@/types/payroll";
import type { Termination } from "@/types/termination";
import type { Thirteenth } from "@/types/thirteenth";
import type { Vacation } from "@/types/vacation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ClipboardList, BookCheck, Gift, SendToBack, UserMinus, Loader2, ListChecks, MoreHorizontal, Eye, Trash2, FileX } from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { RCI } from "@/types/rci";

export default function PessoalPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [rcis, setRcis] = useState<RCI[]>([]);
  const [terminations, setTerminations] = useState<Termination[]>([]);
  const [thirteenths, setThirteenths] = useState<Thirteenth[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(true);
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
    let activeListeners = 5; 
    const onDone = () => {
        activeListeners--;
        if (activeListeners === 0) {
            setLoading(false);
        }
    };
    
    const payrollsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/payrolls`);
    const payrollsQuery = query(payrollsRef, orderBy('createdAt', 'desc'));
    const unsubscribePayrolls = onSnapshot(payrollsQuery, (snapshot) => {
        setPayrolls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() } as Payroll)));
        onDone();
    }, (error) => { console.error("Erro (Payrolls): ", error); toast({ variant: "destructive", title: "Erro ao buscar folhas" }); onDone(); });

    const rcisRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/rcis`);
    const rcisQuery = query(rcisRef, orderBy('createdAt', 'desc'));
    const unsubscribeRcis = onSnapshot(rcisQuery, (snapshot) => {
        setRcis(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() } as RCI)));
        onDone();
    }, (error) => { console.error("Erro (RCIs): ", error); toast({ variant: "destructive", title: "Erro ao buscar RCIs" }); onDone(); });


    const terminationsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/terminations`);
    const terminationsQuery = query(terminationsRef, orderBy('createdAt', 'desc'));
    const unsubscribeTerminations = onSnapshot(terminationsQuery, (snapshot) => {
        setTerminations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), terminationDate: doc.data().terminationDate?.toDate() } as Termination)));
        onDone();
    }, (error) => { console.error("Erro (Terminations): ", error); toast({ variant: "destructive", title: "Erro ao buscar rescisões" }); onDone(); });

    const thirteenthsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/thirteenths`);
    const thirteenthsQuery = query(thirteenthsRef, orderBy('createdAt', 'desc'));
    const unsubscribeThirteenths = onSnapshot(thirteenthsQuery, (snapshot) => {
        setThirteenths(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Thirteenth)));
        onDone();
    }, (error) => { console.error("Erro (13th): ", error); toast({ variant: "destructive", title: "Erro ao buscar 13º" }); onDone(); });

    const vacationsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/vacations`);
    const vacationsQuery = query(vacationsRef, orderBy('createdAt', 'desc'));
    const unsubscribeVacations = onSnapshot(vacationsQuery, (snapshot) => {
        setVacations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), startDate: doc.data().startDate?.toDate() } as Vacation)));
        onDone();
    }, (error) => { console.error("Erro (Vacations): ", error); toast({ variant: "destructive", title: "Erro ao buscar férias" }); onDone(); });


    return () => {
        unsubscribePayrolls();
        unsubscribeRcis();
        unsubscribeTerminations();
        unsubscribeThirteenths();
        unsubscribeVacations();
    };
  }, [user, activeCompany, toast]);

  const handleDeleteGeneric = async (collectionName: string, docId: string, docName: string) => {
      if (!user || !activeCompany) return;
      try {
        await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/${collectionName}`, docId));
        toast({ title: `${docName} excluído(a) com sucesso!` });
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
                <ClipboardList className="mr-2 h-4 w-4" /> Calcular Folha de Pagamento
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline">
               <Link href="/pessoal/rci">
                <ClipboardList className="mr-2 h-4 w-4" /> Calcular RCI
               </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="secondary">
                <Link href="/pessoal/decimo-terceiro">
                    <Gift className="mr-2 h-4 w-4" /> Calcular 13º Salário
                </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="secondary">
                <Link href="/pessoal/ferias">
                    <SendToBack className="mr-2 h-4 w-4" /> Calcular Férias
                </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="destructive">
              <Link href="/pessoal/rescisao">
                <UserMinus className="mr-2 h-4 w-4" /> Calcular Rescisão
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
                <BookCheck className="mr-2 h-4 w-4" /> Resumo da Folha
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
                {payrolls.map((payroll) => (
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
                {rcis.map((rci) => (
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
                {thirteenths.map((thirteenth) => (
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
                {vacations.map((vacation) => (
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
                {terminations.map((termination) => (
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

    