import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, ShoppingCart, Users, Package, FileText } from "lucide-react";
import Link from "next/link";

export default function RelatoriosPage() {
    const reportCards = [
        { 
            href: "/relatorios/vendas",
            title: 'Relatório de Vendas',
            description: 'Analise suas vendas e faturamento por período.',
            icon: TrendingUp,
            buttonText: 'Gerar Relatório'
        },
        { 
            href: "/relatorios/compras",
            title: 'Relatório de Compras',
            description: 'Visualize todas as notas fiscais de entrada.',
            icon: ShoppingCart,
            buttonText: 'Gerar Relatório'
        },
        { 
            href: "/relatorios/funcionarios",
            title: 'Lista de Funcionários',
            description: 'Gere um PDF com a lista de funcionários ativos.',
            icon: Users,
            buttonText: 'Gerar Lista'
        },
        { 
            href: "/relatorios/produtos",
            title: 'Lista de Produtos',
            description: 'Exporte uma lista completa dos seus produtos.',
            icon: Package,
            buttonText: 'Gerar Lista'
        }
    ];


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Central de Relatórios</h1>
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Fiscais e Cadastrais</CardTitle>
          <CardDescription>Selecione um dos relatórios abaixo para extrair informações importantes do sistema.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {reportCards.map((card) => (
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
                                    <FileText className="mr-2 h-4 w-4" />
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
