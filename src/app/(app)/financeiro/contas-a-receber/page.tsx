
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowUpRightSquare } from "lucide-react";

export default function ContasAReceberPage() {

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contas a Receber</h1>
      <Card>
        <CardHeader>
          <CardTitle>Módulo em Desenvolvimento</CardTitle>
          <CardDescription>A funcionalidade de Contas a Receber está sendo construída.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <ArrowUpRightSquare className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Em Breve</h3>
                <p className="text-muted-foreground mt-2">
                    Estamos trabalhando para trazer as ferramentas de gestão de recebimentos para esta seção.
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
