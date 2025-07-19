import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Percent } from "lucide-react";

export default function AliquotasPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cadastro de Alíquotas</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Alíquota
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Alíquotas Cadastradas</CardTitle>
          <CardDescription>Gerencie as alíquotas de impostos aqui.</CardDescription>
        </CardHeader>
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
                <Percent className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Nenhuma alíquota cadastrada</h3>
            <p className="text-muted-foreground mt-2">Clique em "Nova Alíquota" para começar.</p>
        </div>
      </Card>
    </div>
  );
}
