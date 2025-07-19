import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, ShoppingCart, Users, Package } from "lucide-react";

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
          <Button><TrendingUp className="mr-2 h-4 w-4" /> Relatório de Vendas</Button>
          <Button><ShoppingCart className="mr-2 h-4 w-4" /> Relatório de Compras</Button>
          <Button><Users className="mr-2 h-4 w-4" /> Lista de Funcionários</Button>
          <Button><Package className="mr-2 h-4 w-4" /> Lista de Produtos</Button>
        </CardContent>
      </Card>
    </div>
  );
}
