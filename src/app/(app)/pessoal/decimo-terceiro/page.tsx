import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gift, Calculator } from "lucide-react";
import Link from "next/link";

export default function DecimoTerceiroPage() {
  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/pessoal">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Voltar</span>
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Cálculo de 13º Salário</h1>
            </div>
            <Button disabled>
                <Calculator className="mr-2 h-4 w-4"/>
                Calcular 13º Salário
            </Button>
        </div>
      <Card>
        <CardHeader>
          <CardTitle>Cálculo de 13º Salário</CardTitle>
          <CardDescription>Selecione o funcionário e as opções para calcular o 13º.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <Gift className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Funcionalidade em Desenvolvimento</h3>
                <p className="text-muted-foreground mt-2">A tela de cálculo de 13º salário estará disponível em breve.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
