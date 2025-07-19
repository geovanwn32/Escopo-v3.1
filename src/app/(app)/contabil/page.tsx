import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, BookOpen } from "lucide-react";

export default function ContabilPage() {
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Módulo Contábil</h1>
            <div className="flex gap-2">
                <Button variant="outline">Novo Lançamento</Button>
                <Button>Novo Plano de Contas</Button>
            </div>
        </div>
        <Card>
            <CardHeader>
            <CardTitle>Plano de Contas</CardTitle>
            <CardDescription>Gerencie o plano de contas da empresa.</CardDescription>
            </CardHeader>
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <BookOpen className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Nenhuma conta encontrada</h3>
                <p className="text-muted-foreground mt-2">Comece adicionando contas ao seu plano.</p>
            </div>
        </Card>
    </div>
  );
}
