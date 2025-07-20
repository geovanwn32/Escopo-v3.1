
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

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

// Helper to ensure all optional string fields are at least an empty string
const ensureSafeData = (data: any): CompanyFormData => {
    return {
        razaoSocial: data.razaoSocial || "",
        nomeFantasia: data.nomeFantasia || "",
        cnpj: data.cnpj || "",
        regimeTributario: data.regimeTributario || "",
        inscricaoEstadual: data.inscricaoEstadual || "",
        inscricaoMunicipal: data.inscricaoMunicipal || "",
        cep: data.cep || "",
        logradouro: data.logradouro || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        cidade: data.cidade || "",
        uf: data.uf || "",
        telefone: data.telefone || "",
        email: data.email || "",
    };
};


export default function ConfiguracaoPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [loadingCnpj, setLoadingCnpj] = useState(false);
    const [loadingSintegra, setLoadingSintegra] = useState(false);
    const [loadingPage, setLoadingPage] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

    const form = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema),
        defaultValues: ensureSafeData({}), // Initialize with safe empty values
    });

    useEffect(() => {
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (companyId && user) {
            setActiveCompanyId(companyId);
            const fetchCompanyData = async () => {
                const companyRef = doc(db, `users/${user.uid}/companies`, companyId);
                const docSnap = await getDoc(companyRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const formattedCnpj = data.cnpj ? data.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : "";
                    const safeData = ensureSafeData({ ...data, cnpj: formattedCnpj });
                    form.reset(safeData);
                }
                setLoadingPage(false);
            };
            fetchCompanyData();
        } else {
             setLoadingPage(false);
        }
    }, [user, form]);
    
    const handleSintegraLookup = async () => {
        const cnpj = form.getValues("cnpj");
        const uf = form.getValues("uf");

        if (!cnpj || !uf) {
            toast({
                variant: "destructive",
                title: "Dados Incompletos",
                description: "É necessário preencher o CNPJ e a UF para buscar a Inscrição Estadual.",
            });
            return;
        }

        setLoadingSintegra(true);
        try {
            const cleanedCnpj = cnpj.replace(/\D/g, '');
            const response = await fetch(`https://brasilapi.com.br/api/sintegra/v1/${cleanedCnpj}?uf=${uf}`);
            
            if (!response.ok) {
                toast({
                    title: "Inscrição Estadual não encontrada",
                    description: "Nenhuma Inscrição Estadual encontrada para este CNPJ na UF especificada.",
                });
                return;
            }

            const data = await response.json();
            if (data && data.inscricao_estadual) {
                form.setValue("inscricaoEstadual", data.inscricao_estadual);
                 toast({
                    title: "Inscrição Estadual encontrada!",
                    description: "O campo foi preenchido com as informações da BrasilAPI.",
                });
            }

        } catch (error) {
             toast({
                variant: "destructive",
                title: "Erro ao buscar Inscrição Estadual",
                description: "Não foi possível realizar a consulta. Verifique o console.",
            });
        } finally {
            setLoadingSintegra(false);
        }
    }


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
    
    async function onSubmit(data: CompanyFormData) {
        if (!user || !activeCompanyId) {
             toast({
                variant: "destructive",
                title: "Erro",
                description: "Usuário ou empresa não identificados. Não é possível salvar.",
            });
            return;
        }
        setIsSaving(true);
        try {
            const companyRef = doc(db, `users/${user.uid}/companies`, activeCompanyId);
            const dataToSave = {
                ...data,
                cnpj: data.cnpj.replace(/\D/g, ''), // Save only numbers
            };
            await setDoc(companyRef, dataToSave, { merge: true });

            const updatedCompanyDataForSession = { id: activeCompanyId, ...dataToSave };
            sessionStorage.setItem(`company_${activeCompanyId}`, JSON.stringify(updatedCompanyDataForSession));

            toast({
                title: "Dados Salvos!",
                description: "As informações da empresa foram atualizadas com sucesso.",
            });
        } catch (error) {
            console.error("Error saving company data: ", error);
            toast({
                variant: "destructive",
                title: "Erro ao Salvar",
                description: "Ocorreu um problema ao salvar as informações da empresa.",
            });
        } finally {
            setIsSaving(false);
        }
    }

  if (loadingPage) {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
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
                                        <Select onValueChange={field.onChange} value={field.value}>
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
                                        <div className="relative">
                                            <FormControl><Input {...field} /></FormControl>
                                             <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                                {loadingSintegra ? (
                                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                ) : (
                                                    <Search className="h-5 w-5 text-muted-foreground cursor-pointer" onClick={handleSintegraLookup} />
                                                )}
                                            </div>
                                        </div>
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
                        <Button type="submit" disabled={isSaving || loadingPage || loadingCnpj || loadingSintegra}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                            Salvar Todas as Alterações
                        </Button>
                    </div>
                </div>
            </form>
        </Form>
    </div>
  );
}
