
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Calculator, FileDigit, FileText } from "lucide-react";
import Link from "next/link";

export default function ConectividadePage() {
    const conectividadeCards = [
        { 
            href: "/esocial",
            title: 'eSocial',
            description: 'Central de geração e gerenciamento de eventos do eSocial.',
            icon: Share2,
            buttonText: 'Acessar Módulo'
        },
         { 
            href: "/pgdas",
            title: 'PGDAS',
            description: 'Calcule o imposto do Simples Nacional.',
            icon: Calculator,
            buttonText: 'Acessar Módulo'
        },
         { 
            href: "/efd-contribuicoes",
            title: 'EFD Contribuições',
            description: 'Gere o arquivo para o SPED Fiscal.',
            icon: FileDigit,
            buttonText: 'Acessar Módulo'
        },
        { 
            href: "/reinf",
            title: 'EFD-Reinf',
            description: 'Gere os eventos de retenções e informações fiscais.',
            icon: FileText,
            buttonText: 'Acessar Módulo'
        },
    ];


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Módulo de Conectividade</h1>
      <Card>
        <CardHeader>
          <CardTitle>Arquivos para o Governo</CardTitle>
          <CardDescription>Selecione uma das opções abaixo para gerar arquivos para os portais do governo.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {conectividadeCards.map((card) => (
                    <Card key={card.href} className="flex flex-col">
                        <CardHeader className="items-center text-center">
                            <div className="p-3 bg-muted rounded-full mb-2">
                                <card.icon className="h-8 w-8 text-primary" />
                            </div>
                            <CardTitle className="text-lg">{card.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow text-center">
                            <p className="text-sm text-muted-foreground">{card.description}</p>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" asChild>
                                <Link href={card.href}>
                                  {card.buttonText}
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
