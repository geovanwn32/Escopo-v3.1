
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

const usefulLinks = [
    { name: 'Receita Federal', url: 'https://www.gov.br/receitafederal' },
    { name: 'Sefaz GO (Economia - GO)', url: 'https://www.economia.go.gov.br/' },
    { name: 'SINTEGRA', url: 'http://www.sintegra.gov.br/' },
    { name: 'ISS Aparecida de Goiânia', url: 'https://www.issnetonline.com.br/aparecida/online/login/login.aspx' },
    { name: 'Prefeitura de Goiânia', url: 'https://www.goiania.go.gov.br/' },
    { name: 'Prefeitura de Aparecida de Goiânia', url: 'https://www.aparecida.go.gov.br/' },
    { name: 'Portal da Nota Fiscal Eletrônica (NF-e)', url: 'https://www.nfe.fazenda.gov.br/portal/principal.aspx' },
    { name: 'Portal do Conhecimento de Transporte (CT-e)', url: 'https://www.cte.fazenda.gov.br/portal/' },
    { name: 'Nota Fiscal de Serviço (MEI)', url: 'https://www.nfse.gov.br/EmissorNacional/Login' },
    { name: 'JUCEG - Junta Comercial do Estado de Goiás', url: 'https://www.juceg.go.gov.br/' },
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
                    <Button key={link.name} variant="outline" asChild className="justify-start">
                        <Link href={link.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            {link.name}
                        </Link>
                    </Button>
                ))}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
