
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { Company } from '@/app/(app)/fiscal/page';
import type { Payroll } from "@/types/payroll";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ClipboardList, BookCheck, Gift, SendToBack, UserMinus, Loader2, ListChecks } from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function PessoalPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
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
        return;
    };

    setLoading(true);
    const payrollsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/payrolls`);
    const q = query(payrollsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const payrollsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt.toDate(),
        } as Payroll));
        setPayrolls(payrollsData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching payrolls: ", error);
        toast({
            variant: "destructive",
            title: "Erro ao buscar folhas de pagamento",
            description: "Não foi possível carregar a lista de rascunhos."
        });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeCompany, toast]);


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
                <ClipboardList className="mr-2 h-4 w-4" /> Nova Folha de Pagamento
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="secondary" disabled><Gift className="mr-2 h-4 w-4" /> Calcular 13º Salário</Button>
            <Button className="w-full justify-start" variant="secondary" disabled><SendToBack className="mr-2 h-4 w-4" /> Calcular Férias</Button>
            <Button className="w-full justify-start" variant="secondary" disabled><UserMinus className="mr-2 h-4 w-4" /> Calcular Rescisão</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Relatórios</CardTitle>
            <CardDescription>Gere relatórios importantes do departamento pessoal.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button className="w-full justify-start" disabled><BookCheck className="mr-2 h-4 w-4" /> Resumo da Folha</Button>
          </CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Folhas de Pagamento Salvas</CardTitle>
          <CardDescription>Visualize e continue os cálculos salvos como rascunho.</CardDescription>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.map((payroll) => (
                  <TableRow key={payroll.id} className="cursor-pointer hover:bg-muted/50">
                    {/* The Link wrapping the TableCell makes the cell clickable */}
                    <TableCell>
                      <Link href={`/pessoal/folha-de-pagamento?id=${payroll.id}`} className="block w-full h-full font-medium">
                        {payroll.employeeName}
                      </Link>
                    </TableCell>
                    <TableCell>{payroll.period}</TableCell>
                     <TableCell>
                      <Badge variant={payroll.status === 'draft' ? 'secondary' : 'default'}>
                        {payroll.status === 'draft' ? 'Rascunho' : 'Finalizada'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payroll.totals.liquido)}
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
