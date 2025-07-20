
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";

export default function ObrigacoesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Obrigações</h1>
      <Card>
        <CardHeader>
          <CardTitle>Módulo de Obrigações</CardTitle>
          <CardDescription>Gerencie e transmita as obrigações acessórias da empresa.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button><Share2 className="mr-2 h-4 w-4" /> eSocial</Button>
          <Button><Share2 className="mr-2 h-4 w-4" /> EFD-Reinf</Button>
          <Button><Share2 className="mr-2 h-4 w-4" /> DCTFWeb</Button>
          <Button><Share2 className="mr-2 h-4 w-4" /> PGDAS</Button>
          <Button><Share2 className="mr-2 h-4 w-4" /> SPED Fiscal</Button>
          <Button><Share2 className="mr-2 h-4 w-4" /> SPED Contribuições</Button>
          <Button><Share2 className="mr-2 h-4 w-4" /> ECD</Button>
        </CardContent>
      </Card>
    </div>
  );
}
