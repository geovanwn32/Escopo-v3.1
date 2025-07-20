import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, ShoppingCart, Users, Package } from "lucide-react";
import Link from "next/link";

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gerador de Relatórios</h1>
      <Card>
        <CardHeader>
          <CardTitle>Selecione o Relatório</CardTitle>
          <CardDescription>Escolha um dos relatórios abaixo para gerar.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button asChild>
            <Link href="/relatorios/vendas">
              <TrendingUp className="mr-2 h-4 w-4" /> Relatório de Vendas
            </Link>
          </Button>
          <Button asChild>
            <Link href="/relatorios/compras">
                <ShoppingCart className="mr-2 h-4 w-4" /> Relatório de Compras
            </Link>
          </Button>
          <Button asChild>
            <Link href="/relatorios/funcionarios">
                <Users className="mr-2 h-4 w-4" /> Lista de Funcionários
            </Link>
          </Button>
           <Button asChild>
            <Link href="/relatorios/produtos">
                <Package className="mr-2 h-4 w-4" /> Lista de Produtos
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
