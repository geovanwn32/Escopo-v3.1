
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileArchive } from "lucide-react";

export default function ArquivosPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Repositório de Arquivos</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Novo Arquivo
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Arquivos da Empresa</CardTitle>
          <CardDescription>Gerencie documentos e arquivos importantes da sua empresa.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <FileArchive className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Nenhum arquivo encontrado</h3>
                <p className="text-muted-foreground mt-2">Clique em "Adicionar Novo Arquivo" para começar a enviar.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
