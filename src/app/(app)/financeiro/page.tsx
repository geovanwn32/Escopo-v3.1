
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownLeftSquare, ArrowUpRightSquare, Banknote, LineChart, ArrowRight, Scale } from "lucide-react";
import Link from "next/link";

const financialSections = [
    {
        href: "/financeiro/contas-a-receber",
        title: "Contas a Receber",
        description: "Gerencie faturas, recebimentos e inadimplência de clientes.",
        icon: ArrowUpRightSquare,
    },
    {
        href: "/financeiro/contas-a-pagar",
        title: "Contas a Pagar",
        description: "Controle as obrigações, faturas de fornecedores e despesas.",
        icon: ArrowDownLeftSquare,
    },
    {
        href: "/financeiro/fluxo-de-caixa",
        title: "Fluxo de Caixa",
        description: "Visualize e projete as entradas e saídas de dinheiro da empresa.",
        icon: LineChart,
    },
    {
        href: "/financeiro/conciliacao",
        title: "Conciliação Bancária",
        description: "Compare seus registros com os extratos bancários de forma automática.",
        icon: Scale,
    },
];

export default function FinanceiroPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Módulo Financeiro</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Central Financeira</CardTitle>
                    <CardDescription>Selecione uma das opções abaixo para gerenciar as finanças da sua empresa.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {financialSections.map((section) => (
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
