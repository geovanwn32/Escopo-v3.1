
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookMarked, ListChecks, Banknote, LineChart, ArrowRight, UploadCloud, BookUp, Sparkles } from "lucide-react";
import Link from "next/link";

const accountingSections = [
    {
        href: "/contabil/plano-de-contas",
        title: "Plano de Contas",
        icon: BookMarked,
        className: "bg-blue-100 text-blue-800 hover:bg-blue-200"
    },
    {
        href: "/contabil/lancamentos",
        title: "Lançamentos Manuais",
        icon: ListChecks,
        className: "bg-green-100 text-green-800 hover:bg-green-200"
    },
    {
        href: "/contabil/importacao-extrato",
        title: "Categorização com IA",
        icon: Sparkles,
        className: "bg-purple-100 text-purple-800 hover:bg-purple-200"
    },
    {
        href: "/contabil/conciliacao",
        title: "Conciliação Bancária",
        icon: Banknote,
        className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
    },
    {
        href: "/contabil/relatorios-contabeis",
        title: "Relatórios Contábeis",
        icon: LineChart,
        className: "bg-red-100 text-red-800 hover:bg-red-200"
    },
];

export default function ContabilPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Módulo Contábil</h1>
             <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Central Contábil</CardTitle>
                        <CardDescription>Selecione uma das opções abaixo para gerenciar a contabilidade da sua empresa.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                         {accountingSections.map((section) => (
                            <Button asChild key={section.href} className={`w-full justify-start ${section.className}`}>
                                <Link href={section.href}>
                                    <span><section.icon className="mr-2 h-4 w-4" />{section.title}</span>
                                </Link>
                            </Button>
                        ))}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Atalhos Rápidos</CardTitle>
                        <CardDescription>Acesse rapidamente as funções mais usadas.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                         <Button asChild className="w-full justify-start">
                            <Link href="/contabil/lancamentos">
                                <span><ListChecks className="mr-2 h-4 w-4" />Novo Lançamento</span>
                            </Link>
                        </Button>
                         <Button asChild className="w-full justify-start">
                            <Link href="/contabil/plano-de-contas">
                                <span><BookUp className="mr-2 h-4 w-4" />Importar Plano de Contas</span>
                            </Link>
                        </Button>
                         <Button asChild className="w-full justify-start">
                            <Link href="/contabil/relatorios-contabeis">
                                <span><LineChart className="mr-2 h-4 w-4" />Gerar Balancete</span>
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
