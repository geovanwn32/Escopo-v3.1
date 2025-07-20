
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const companySchema = z.object({
  razaoSocial: z.string().min(1, "Razão Social é obrigatória."),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().refine((value) => /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(value), {
    message: "CNPJ inválido.",
  }),
  regimeTributario: z.string().optional(),
  inscricaoEstadual: z.string().optional(),
  inscricaoMunicipal: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email({ message: "Email inválido." }).optional().or(z.literal('')),
});

type CompanyFormData = z.infer<typeof companySchema>;

export default function ConfiguracaoPage() {
    const { toast } = useToast();
    const [loadingCnpj, setLoadingCnpj] = useState(false);

    const form = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema),
        defaultValues: {
            razaoSocial: "",
            nomeFantasia: "",
            cnpj: "",
            regimeTributario: "",
            inscricaoEstadual: "",
            inscricaoMunicipal: "",
            cep: "",
            logradouro: "",
            numero: "",
            complemento: "",
            bairro: "",
            cidade: "",
            uf: "",
            telefone: "",
            email: "",
        },
    });

    const handleCnpjLookup = async () => {
        const cnpjValue = form.getValues("cnpj");
        if (!cnpjValue || cnpjValue.replace(/\D/g, '').length !== 14) {
            toast({
                variant: "destructive",
                title: "CNPJ Inválido",
                description: "Por favor, digite um CNPJ com 14 dígitos.",
            });
            return;
        }

        setLoadingCnpj(true);
        try {
            const cleanedCnpj = cnpjValue.replace(/\D/g, '');
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanedCnpj}`);
            
            if (!response.ok) {
                throw new Error('CNPJ não encontrado ou API indisponível.');
            }

            const data = await response.json();
            
            form.setValue("razaoSocial", data.razao_social || "");
            form.setValue("nomeFantasia", data.nome_fantasia || "");
            form.setValue("inscricaoEstadual", data.inscricao_estadual || "");
            form.setValue("cep", data.cep || "");
            form.setValue("logradouro", data.logradouro || "");
            form.setValue("numero", data.numero || "");
            form.setValue("complemento", data.complemento || "");
            form.setValue("bairro", data.bairro || "");
            form.setValue("cidade", data.municipio || "");
            form.setValue("uf", data.uf || "");
            form.setValue("telefone", data.ddd_telefone_1 || "");
            form.setValue("email", data.email || "");

            toast({
                title: "Dados do CNPJ carregados!",
                description: "Os campos foram preenchidos com as informações da BrasilAPI.",
            });

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro ao buscar CNPJ",
                description: "Não foi possível carregar os dados. Verifique o CNPJ e tente novamente.",
            });
        } finally {
            setLoadingCnpj(false);
        }
    };
    
    function onSubmit(data: CompanyFormData) {
        // Here you would typically save the data to your backend
        console.log(data);
        toast({
            title: "Dados Salvos (Simulação)",
            description: "As informações da empresa foram salvas com sucesso.",
        });
    }

  return (
    <div className="space-y-6">
        <h1 className="text-2xl font-bold">Configurações da Empresa</h1>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dados Cadastrais</CardTitle>
                            <CardDescription>Informações principais e fiscais da empresa.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                             <FormField
                                control={form.control}
                                name="razaoSocial"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Razão Social</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="nomeFantasia"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nome Fantasia</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="cnpj"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CNPJ</FormLabel>
                                        <div className="relative">
                                            <FormControl>
                                                <Input 
                                                    {...field}
                                                    placeholder="00.000.000/0001-00"
                                                    onChange={(e) => {
                                                        const { value } = e.target;
                                                        e.target.value = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
                                                        field.onChange(e);
                                                    }}
                                                    onBlur={handleCnpjLookup}
                                                />
                                            </FormControl>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                                {loadingCnpj ? (
                                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                ) : (
                                                    <Search className="h-5 w-5 text-muted-foreground cursor-pointer" onClick={handleCnpjLookup} />
                                                )}
                                            </div>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="regimeTributario"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Regime Tributário</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione o regime" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="simples">Simples Nacional</SelectItem>
                                                <SelectItem value="presumido">Lucro Presumido</SelectItem>
                                                <SelectItem value="real">Lucro Real</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="inscricaoEstadual"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Inscrição Estadual</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="inscricaoMunicipal"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Inscrição Municipal</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle>Endereço</CardTitle>
                            <CardDescription>Endereço da sede da empresa.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-3">
                            <FormField
                                control={form.control}
                                name="cep"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-1">
                                        <FormLabel>CEP</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="logradouro"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Logradouro</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="numero"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Número</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="complemento"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Complemento</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="bairro"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bairro</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="cidade"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cidade</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="uf"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>UF</FormLabel>
                                        <FormControl><Input {...field} maxLength={2} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle>Contato</CardTitle>
                            <CardDescription>Informações de contato da empresa.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                             <FormField
                                control={form.control}
                                name="telefone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Telefone</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl><Input type="email" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                     <div className="flex justify-end">
                        <Button type="submit"><Save className="mr-2 h-4 w-4" /> Salvar Todas as Alterações</Button>
                    </div>
                </div>
            </form>
        </Form>
    </div>
  );
}
