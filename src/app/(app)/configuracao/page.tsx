
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
        <div className="grid gap-6 lg:grid-cols-1">
            <Card>
                <CardHeader>
                    <CardTitle>Dados Cadastrais</CardTitle>
                    <CardDescription>Informações principais e fiscais da empresa.</CardDescription>
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
                     <div className="space-y-2">
                        <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
                        <Input id="inscricaoEstadual" placeholder="123.456.789.112" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="inscricaoMunicipal">Inscrição Municipal</Label>
                        <Input id="inscricaoMunicipal" placeholder="987654321" />
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Endereço</CardTitle>
                    <CardDescription>Endereço da sede da empresa.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                     <div className="space-y-2 md:col-span-1">
                        <Label htmlFor="cep">CEP</Label>
                        <Input id="cep" placeholder="00000-000" />
                    </div>
                     <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="logradouro">Logradouro</Label>
                        <Input id="logradouro" placeholder="Avenida Principal" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="numero">Número</Label>
                        <Input id="numero" placeholder="123" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="complemento">Complemento</Label>
                        <Input id="complemento" placeholder="Sala 101" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="bairro">Bairro</Label>
                        <Input id="bairro" placeholder="Centro" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="cidade">Cidade</Label>
                        <Input id="cidade" placeholder="Sua Cidade" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="uf">UF</Label>
                        <Input id="uf" placeholder="SP" maxLength={2} />
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Contato</CardTitle>
                    <CardDescription>Informações de contato da empresa.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                     <div className="space-y-2">
                        <Label htmlFor="telefone">Telefone</Label>
                        <Input id="telefone" placeholder="(11) 99999-9999" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" placeholder="contato@suaempresa.com" />
                    </div>
                </CardContent>
            </Card>

             <div className="flex justify-end">
                <Button><Save className="mr-2 h-4 w-4" /> Salvar Todas as Alterações</Button>
            </div>
        </div>
    </div>
  );
}
