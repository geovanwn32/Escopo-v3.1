
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookMark, ListChecks, Banknote, LineChart, ArrowRight } from "lucide-react";
import Link from "next/link";

const accountingSections = [
    {
        href: "/contabil/plano-de-contas",
        title: "Plano de Contas",
        description: "Gerencie a estrutura de contas contábeis da sua empresa.",
        icon: BookMark,
    },
    {
        href: "/contabil/lancamentos",
        title: "Lançamentos Manuais",
        description: "Registre os lançamentos contábeis de débito e crédito.",
        icon: ListChecks,
    },
    {
        href: "/contabil/conciliacao",
        title: "Conciliação Bancária",
        description: "Reconcilie extratos bancários com seus registros contábeis.",
        icon: Banknote,
    },
    {
        href: "/contabil/relatorios-contabeis",
        title: "Relatórios Contábeis",
        description: "Gere Balancetes, DRE, Balanço Patrimonial e outros relatórios.",
        icon: LineChart,
    },
];

export default function ContabilPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Módulo Contábil</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Central Contábil</CardTitle>
                    <CardDescription>Selecione uma das opções abaixo para gerenciar a contabilidade da sua empresa.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {accountingSections.map((section) => (
                            <Card key={section.href} className="flex flex-col">
                                <CardHeader className="flex-row items-start gap-4 space-y-0">
                                     <div className="p-3 bg-muted rounded-md">
                                        <section.icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <CardTitle className="text-lg">{section.title}</CardTitle>
                                        <CardDescription className="mt-1">{section.description}</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardFooter className="mt-auto">
                                    <Button asChild className="w-full">
                                        <Link href={section.href}>
                                            Acessar Módulo <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
