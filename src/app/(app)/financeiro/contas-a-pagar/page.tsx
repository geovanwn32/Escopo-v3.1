
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowDownLeftSquare } from "lucide-react";

export default function ContasAPagarPage() {

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contas a Pagar</h1>
      <Card>
        <CardHeader>
          <CardTitle>Módulo em Desenvolvimento</CardTitle>
          <CardDescription>A funcionalidade de Contas a Pagar está sendo construída.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <ArrowDownLeftSquare className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Em Breve</h3>
                <p className="text-muted-foreground mt-2">
                    Estamos trabalhando para trazer as ferramentas de gestão de pagamentos para esta seção.
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
