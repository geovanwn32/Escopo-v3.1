import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PlusCircle, BookOpen, ChevronsRightLeft, BookLock, ChevronDown } from "lucide-react";

export default function ContabilPage() {
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Módulo Contábil</h1>
            <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      Lançamentos Manuais
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      <span>Lançamento Simples</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <ChevronsRightLeft className="mr-2 h-4 w-4" />
                      <span>Lançamento Múltiplo</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <BookLock className="mr-2 h-4 w-4" />
                      <span>Lançamento de Encerramento</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Novo Plano de Contas
                </Button>
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
