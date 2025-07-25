
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownLeftSquare, ArrowUpRightSquare, LineChart, Scale } from "lucide-react";
import Link from "next/link";

const financialSections = [
    {
        href: "/financeiro/contas-a-receber",
        title: "Contas a Receber",
        description: "Gerencie faturas, recebimentos e inadimplência de clientes.",
        icon: ArrowUpRightSquare,
        className: "bg-blue-100 text-blue-800 hover:bg-blue-200"
    },
    {
        href: "/financeiro/contas-a-pagar",
        title: "Contas a Pagar",
        description: "Controle as obrigações, faturas de fornecedores e despesas.",
        icon: ArrowDownLeftSquare,
        className: "bg-red-100 text-red-800 hover:bg-red-200"
    },
    {
        href: "/financeiro/fluxo-de-caixa",
        title: "Fluxo de Caixa",
        description: "Visualize e projete as entradas e saídas de dinheiro da empresa.",
        icon: LineChart,
         className: "bg-green-100 text-green-800 hover:bg-green-200"
    },
    {
        href: "/financeiro/conciliacao",
        title: "Conciliação Bancária",
        description: "Compare seus registros com os extratos bancários de forma automática.",
        icon: Scale,
        className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
    },
];

export default function FinanceiroPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Módulo Financeiro</h1>
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Central Financeira</CardTitle>
                        <CardDescription>Selecione uma das opções abaixo para gerenciar as finanças da sua empresa.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                         {financialSections.map((section) => (
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
                        <CardTitle>Relatórios Financeiros</CardTitle>
                        <CardDescription>Gere relatórios para análise e tomada de decisão.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                         <Button asChild className="w-full justify-start">
                            <Link href="/relatorios/vendas">
                                <span><LineChart className="mr-2 h-4 w-4" />Relatório de Vendas</span>
                            </Link>
                        </Button>
                         <Button asChild className="w-full justify-start">
                            <Link href="/relatorios/compras">
                                <span><ArrowDownLeftSquare className="mr-2 h-4 w-4" />Relatório de Compras</span>
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
