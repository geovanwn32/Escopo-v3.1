import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações Gerais</h1>
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Sistema</CardTitle>
          <CardDescription>Gerencie as configurações gerais do sistema aqui.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
                <Settings className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Nenhuma configuração disponível</h3>
            <p className="text-muted-foreground mt-2">Esta área será utilizada para futuras configurações do sistema.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
