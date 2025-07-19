import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function EmpresasPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dados da Empresa Ativa</h1>
      <Card>
        <CardHeader>
          <CardTitle>Empresa Ativa</CardTitle>
          <CardDescription>Informações da empresa que você está gerenciando.</CardDescription>
        </CardHeader>
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
                <Building2 className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Nenhuma empresa selecionada</h3>
            <p className="text-muted-foreground mt-2">Use o botão "Trocar Empresa" para selecionar uma.</p>
        </div>
      </Card>
    </div>
  );
}
