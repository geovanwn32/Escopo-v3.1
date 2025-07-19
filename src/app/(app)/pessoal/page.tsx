
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ClipboardList, BookCheck, Gift, SendToBack, UserMinus } from "lucide-react";
import Link from "next/link";

export default function PessoalPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Módulo Pessoal</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cálculos e Processamentos</CardTitle>
            <CardDescription>Execute os principais cálculos da folha de pagamento.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="w-full justify-start">
              <Link href="/pessoal/folha-de-pagamento">
                <ClipboardList className="mr-2 h-4 w-4" /> Folha de Pagamento
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="secondary"><Gift className="mr-2 h-4 w-4" /> Calcular 13º Salário</Button>
            <Button className="w-full justify-start" variant="secondary"><SendToBack className="mr-2 h-4 w-4" /> Calcular Férias</Button>
            <Button className="w-full justify-start" variant="secondary"><UserMinus className="mr-2 h-4 w-4" /> Calcular Rescisão</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Relatórios</CardTitle>
            <CardDescription>Gere relatórios importantes do departamento pessoal.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button className="w-full justify-start"><BookCheck className="mr-2 h-4 w-4" /> Resumo da Folha</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
