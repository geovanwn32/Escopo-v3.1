
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, BookOpen, BookUser } from "lucide-react";
import Link from "next/link";

export default function ContabilPage() {
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Módulo Contábil</h1>
            <div className="flex gap-2">
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Novo Lançamento
                </Button>
                 <Button variant="outline" asChild>
                  <Link href="/contabil/plano-de-contas">
                    <BookUser className="mr-2 h-4 w-4" />
                    Plano de Contas
                  </Link>
                </Button>
            </div>
        </div>
        <Card>
            <CardHeader>
            <CardTitle>Diário Contábil</CardTitle>
            <CardDescription>Visualize os lançamentos contábeis da empresa.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 bg-muted rounded-full mb-4">
                        <BookOpen className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">Nenhum lançamento encontrado</h3>
                    <p className="text-muted-foreground mt-2">Comece a fazer lançamentos manuais ou importe do módulo fiscal.</p>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
