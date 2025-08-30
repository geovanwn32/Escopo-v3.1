
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Link2, CalendarSearch } from "lucide-react";
import Link from "next/link";

const usefulLinks = [
    { name: 'Receita Federal', url: 'https://www.gov.br/receitafederal', icon: Link2 },
    { name: 'Sefaz GO (Economia - GO)', url: 'https://www.economia.go.gov.br/', icon: Link2 },
    { name: 'SINTEGRA', url: 'http://www.sintegra.gov.br/', icon: Link2 },
    { name: 'ISS Aparecida de Goiânia', url: 'https://www.issnetonline.com.br/aparecida/online/login/login.aspx', icon: Link2 },
    { name: 'Prefeitura de Goiânia', url: 'https://www.goiania.go.gov.br/', icon: Link2 },
    { name: 'Prefeitura de Aparecida de Goiânia', url: 'https://www.aparecida.go.gov.br/', icon: Link2 },
    { name: 'Portal da Nota Fiscal Eletrônica (NF-e)', url: 'https://www.nfe.fazenda.gov.br/portal/principal.aspx', icon: Link2 },
    { name: 'Portal do Conhecimento de Transporte (CT-e)', url: 'https://www.cte.fazenda.gov.br/portal/', icon: Link2 },
    { name: 'Nota Fiscal de Serviço (MEI)', url: 'https://www.nfse.gov.br/EmissorNacional/Login', icon: Link2 },
    { name: 'JUCEG - Junta Comercial do Estado de Goiás', url: 'https://www.juceg.go.gov.br/', icon: Link2 },
    { name: 'Agenda Tributária - Receita Federal', url: 'https://www.gov.br/receitafederal/pt-br/assuntos/agenda-tributaria', icon: CalendarSearch },
]

export default function LinksUteisPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Links Úteis</h1>
      <Card>
        <CardHeader>
          <CardTitle>Acesso Rápido</CardTitle>
          <CardDescription>Acesse rapidamente os principais portais governamentais e de serviços.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {usefulLinks.map((link) => (
                    <Card key={link.name} className="flex flex-col">
                      <CardHeader className="flex-row items-center gap-4 space-y-0">
                         <div className="p-2 bg-muted rounded-md">
                            <link.icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <CardTitle className="text-base font-medium leading-tight">{link.name}</CardTitle>
                      </CardHeader>
                      <CardFooter className="mt-auto">
                        <Button asChild className="w-full" variant="outline">
                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Acessar
                            </a>
                        </Button>
                      </CardFooter>
                    </Card>
                ))}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
