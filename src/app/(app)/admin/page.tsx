
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Painel de Administração</h1>
      <Card>
        <CardHeader>
          <CardTitle>Módulo Desativado</CardTitle>
          <CardDescription>
            Esta funcionalidade foi removida.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Carregando...</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
