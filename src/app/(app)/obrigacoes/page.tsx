
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Share2 } from "lucide-react";

export default function ObrigacoesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Obrigações</h1>
      <Card>
        <CardHeader>
          <CardTitle>Módulo de Obrigações</CardTitle>
          <CardDescription>Gerencie as obrigações acessórias da empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
                <Share2 className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Funcionalidade em Desenvolvimento</h3>
            <p className="text-muted-foreground mt-2">Esta área será utilizada para a transmissão de obrigações como eSocial, EFD-Reinf, DCTFWeb e PGDAS.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
