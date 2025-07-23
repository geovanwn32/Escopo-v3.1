
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LineChart } from "lucide-react";

export default function RelatoriosContabeisPage() {

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Relatórios Contábeis</h1>
      <Card>
        <CardHeader>
          <CardTitle>Módulo em Desenvolvimento</CardTitle>
          <CardDescription>A funcionalidade de Relatórios Contábeis está sendo construída.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <LineChart className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Em Breve</h3>
                <p className="text-muted-foreground mt-2">
                    Estamos trabalhando para trazer a geração de relatórios como DRE e Balanço Patrimonial.
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
