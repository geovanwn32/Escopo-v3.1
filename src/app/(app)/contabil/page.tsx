
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookMarked, ListChecks, Banknote, LineChart, ArrowRight, ArrowLeft, UploadCloud, BookUp, Sparkles } from "lucide-react";
import Link from "next/link";

const accountingSections = [
    {
        href: "/contabil/plano-de-contas",
        title: "Plano de Contas",
        icon: BookMarked,
        description: "Estruture e gerencie as contas contábeis da sua empresa.",
        className: "bg-blue-100 text-blue-800 hover:bg-blue-200"
    },
    {
        href: "/contabil/lancamentos",
        title: "Lançamentos Manuais",
        icon: ListChecks,
        description: "Realize lançamentos contábeis de partidas dobradas manualmente.",
        className: "bg-green-100 text-green-800 hover:bg-green-200"
    },
    {
        href: "/contabil/importacao-extrato",
        title: "Categorização com IA",
        icon: Sparkles,
        description: "Importe extratos (PDF, CSV) e deixe a IA extrair as transações.",
        className: "bg-purple-100 text-purple-800 hover:bg-purple-200"
    },
    {
        href: "/contabil/conciliacao",
        title: "Conciliação Bancária",
        icon: Banknote,
        description: "Compare seus lançamentos com o extrato bancário.",
        className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
    },
    {
        href: "/contabil/relatorios-contabeis",
        title: "Relatórios Contábeis",
        icon: LineChart,
        description: "Gere balancetes, DRE e balanços patrimoniais.",
        className: "bg-red-100 text-red-800 hover:bg-red-200"
    },
];

export default function ContabilPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Voltar para Dashboard</span>
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Módulo Contábil</h1>
            </div>
             <div className="grid gap-6 md:grid-cols-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Central Contábil</CardTitle>
                        <CardDescription>Selecione uma das opções abaixo para gerenciar a contabilidade da sua empresa.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                         {accountingSections.map((section) => (
                            <Card key={section.href} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                         <div className={`p-2 rounded-md ${section.className}`}>
                                            <section.icon className="h-5 w-5" />
                                        </div>
                                        {section.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground">{section.description}</p>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild className="w-full justify-center">
                                        <Link href={section.href}>
                                            <span>Acessar</span>
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
