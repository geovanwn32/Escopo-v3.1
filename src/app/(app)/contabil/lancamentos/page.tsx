
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ListChecks } from "lucide-react";

export default function LancamentosPage() {

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lançamentos Contábeis</h1>
      <Card>
        <CardHeader>
          <CardTitle>Módulo em Desenvolvimento</CardTitle>
          <CardDescription>A funcionalidade de Lançamentos Contábeis está sendo construída.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <ListChecks className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Em Breve</h3>
                <p className="text-muted-foreground mt-2">
                    Estamos trabalhando para trazer o registro de lançamentos manuais para esta seção.
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
