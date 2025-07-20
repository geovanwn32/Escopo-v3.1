
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, ArrowLeft, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import Link from 'next/link';
import type { Company } from '@/types/company';
import { generateEmployeesListPdf } from "@/services/employees-list-service";

export default function FuncionariosReportPage() {
    const [isGenerating, setIsGenerating] = useState(false);
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

    const handleGenerateReport = async () => {
        if (!user || !activeCompany) {
            toast({ variant: 'destructive', title: 'Usuário ou empresa não identificados.' });
            return;
        }

        setIsGenerating(true);
        try {
            await generateEmployeesListPdf(user.uid, activeCompany);
        } catch (error) {
            console.error("Erro ao gerar lista de funcionários:", error);
            toast({ variant: 'destructive', title: 'Erro ao gerar relatório', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/relatorios">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Voltar</span>
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Relatório de Funcionários</h1>
            </div>

            <Card className="max-w-xl mx-auto">
                <CardHeader className="items-center text-center">
                    <div className="p-4 bg-primary/10 rounded-full mb-2">
                        <Users className="h-10 w-10 text-primary" />
                    </div>
                    <CardTitle>Gerar Lista de Funcionários</CardTitle>
                    <CardDescription>Clique no botão abaixo para gerar um PDF com a lista de todos os funcionários ativos cadastrados.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleGenerateReport} className="w-full" disabled={isGenerating || !activeCompany}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        Gerar Lista em PDF
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
