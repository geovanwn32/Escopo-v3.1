
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, BookOpen, BookUser } from "lucide-react";
import Link from "next/link";

export default function ContabilPage() {
  return (
    <div className="space-y-6">
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
