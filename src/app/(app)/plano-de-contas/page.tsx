import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, BookLock } from "lucide-react";

export default function PlanoDeContasPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Plano de Contas</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Conta
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Contas Cadastradas</CardTitle>
          <CardDescription>Gerencie a estrutura do seu plano de contas aqui.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <BookLock className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Nenhuma conta cadastrada</h3>
                <p className="text-muted-foreground mt-2">Clique em "Nova Conta" para começar a estruturar seu plano de contas.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
