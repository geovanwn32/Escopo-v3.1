import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";

export default function ConfiguracaoPage() {
  return (
    <div className="space-y-6">
        <h1 className="text-2xl font-bold">Configurações da Empresa</h1>
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Dados Cadastrais</CardTitle>
                    <CardDescription>Informações principais da empresa.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                     <div className="space-y-2">
                        <Label htmlFor="razaoSocial">Razão Social</Label>
                        <Input id="razaoSocial" placeholder="Sua Empresa LTDA" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                        <Input id="nomeFantasia" placeholder="Nome Fantasia" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cnpj">CNPJ</Label>
                        <Input id="cnpj" placeholder="00.000.000/0001-00" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="regimeTributario">Regime Tributário</Label>
                        <Select>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o regime" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="simples">Simples Nacional</SelectItem>
                                <SelectItem value="presumido">Lucro Presumido</SelectItem>
                                <SelectItem value="real">Lucro Real</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                    <Button><Save className="mr-2 h-4 w-4" /> Salvar Alterações</Button>
                </CardFooter>
            </Card>
        </div>
    </div>
  );
}
