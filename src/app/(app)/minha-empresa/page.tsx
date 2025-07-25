
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save, Loader2, Search, FileKey, ShieldCheck, FileText, KeyRound, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { EstablishmentForm } from "@/components/empresa/establishment-form";
import type { Company, EstablishmentData } from '@/types/company';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ReopenPeriodModal } from "@/components/fiscal/reopen-period-modal";
import Image from "next/image";

const companySchema = z.object({
  razaoSocial: z.string().min(1, "Razão Social é obrigatória."),
  nomeFantasia: z.string().optional(),
  tipoInscricao: z.enum(['cnpj', 'cpf']),
  inscricao: z.string().min(1, "CNPJ/CPF é obrigatório"),
  cnaePrincipalCodigo: z.string().optional(),
  cnaePrincipalDescricao: z.string().optional(),
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
  logoUrl: z.string().url().optional().nullable(),
  logoPath: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
    const { tipoInscricao, inscricao } = data;
    const cleanedInscricao = inscricao.replace(/\D/g, '');

    if (tipoInscricao === 'cnpj' && cleanedInscricao.length !== 14) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "CNPJ inválido.",
            path: ["inscricao"]
        });
    }
    if (tipoInscricao === 'cpf' && cleanedInscricao.length !== 11) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "CPF inválido.",
            path: ["inscricao"]
        });
    }
});

type CompanyFormData = z.infer<typeof companySchema>;

const ensureSafeData = (data: any): Partial<CompanyFormData> => {
    return {
        razaoSocial: data.razaoSocial || "",
        nomeFantasia: data.nomeFantasia || "",
        tipoInscricao: data.tipoInscricao || 'cnpj',
        inscricao: data.cnpj || data.inscricao || "",
        cnaePrincipalCodigo: data.cnaePrincipalCodigo || "",
        cnaePrincipalDescricao: data.cnaePrincipalDescricao || "",
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
        logoUrl: data.logoUrl || null,
        logoPath: data.logoPath || null,
    };
};


export default function MinhaEmpresaPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [loadingCnpj, setLoadingCnpj] = useState(false);
    const [loadingSintegra, setLoadingSintegra] = useState(false);
    const [loadingPage, setLoadingPage] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
    const [establishmentData, setEstablishmentData] = useState<EstablishmentData | null>(null);
    const [isEstablishmentModalOpen, setEstablishmentModalOpen] = useState(false);
    const [isReopenPeriodModalOpen, setReopenPeriodModalOpen] = useState(false);


    const form = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema),
        defaultValues: ensureSafeData({}),
    });
    
    const tipoInscricao = form.watch('tipoInscricao');
    const logoUrl = form.watch('logoUrl');

    useEffect(() => {
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (companyId && user) {
            setActiveCompanyId(companyId);
            const fetchCompanyData = async () => {
                const companyRef = doc(db, `users/${user.uid}/companies`, companyId);
                const establishmentRef = doc(db, `users/${user.uid}/companies/${companyId}/esocial`, 'establishment');
                
                const [companySnap, establishmentSnap] = await Promise.all([getDoc(companyRef), getDoc(establishmentRef)]);

                if (companySnap.exists()) {
                    const data = companySnap.data();
                    const inscricaoValue = data.cnpj || data.inscricao;
                    let formattedInscricao = inscricaoValue || "";
                    if (data.tipoInscricao === 'cnpj' || (!data.tipoInscricao && inscricaoValue?.length > 11)) {
                         formattedInscricao = inscricaoValue.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
                    } else if (data.tipoInscricao === 'cpf') {
                         formattedInscricao = inscricaoValue.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                    }
                    
                    const safeData = ensureSafeData({ ...data, inscricao: formattedInscricao });
                    form.reset(safeData);
                }
                if (establishmentSnap.exists()) {
                    setEstablishmentData(establishmentSnap.data() as EstablishmentData);
                }
                setLoadingPage(false);
            };
            fetchCompanyData();
        } else {
             setLoadingPage(false);
        }
    }, [user, form]);
    
    const handleSintegraLookup = async () => {
        const inscricao = form.getValues("inscricao");
        const uf = form.getValues("uf");
        const tipo = form.getValues("tipoInscricao");

        if (tipo !== 'cnpj') {
            toast({ variant: "destructive", title: "Função não aplicável", description: "Busca de Inscrição Estadual disponível apenas para CNPJ." });
            return;
        }

        if (!inscricao || !uf) {
            toast({
                variant: "destructive",
                title: "Dados Incompletos",
                description: "É necessário preencher o CNPJ e a UF para buscar a Inscrição Estadual.",
            });
            return;
        }

        setLoadingSintegra(true);
        try {
            const cleanedCnpj = inscricao.replace(/\D/g, '');
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
        const inscricaoValue = form.getValues("inscricao");
        if (tipoInscricao !== 'cnpj' || !inscricaoValue || inscricaoValue.replace(/\D/g, '').length !== 14) {
            toast({
                variant: "destructive",
                title: "CNPJ Inválido",
                description: "Por favor, digite um CNPJ com 14 dígitos.",
            });
            return;
        }

        setLoadingCnpj(true);
        try {
            const cleanedCnpj = inscricaoValue.replace(/\D/g, '');
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanedCnpj}`);
            
            if (!response.ok) {
                throw new Error('CNPJ não encontrado ou API indisponível.');
            }

            const data = await response.json();
            
            form.setValue("razaoSocial", data.razao_social || "");
            form.setValue("nomeFantasia", data.nome_fantasia || "");
            form.setValue("cnaePrincipalCodigo", String(data.cnae_fiscal || ""));
            form.setValue("cnaePrincipalDescricao", data.cnae_fiscal_descricao || "");
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
            const dataToSave: any = {
                ...data,
                cnpj: data.tipoInscricao === 'cnpj' ? data.inscricao.replace(/\D/g, '') : null,
                cpf: data.tipoInscricao === 'cpf' ? data.inscricao.replace(/\D/g, '') : null,
            };
            delete dataToSave.inscricao;
            
            const companyRef = doc(db, `users/${user.uid}/companies`, activeCompanyId);
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

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user || !activeCompanyId) {
            return;
        }
        const file = e.target.files[0];
        const allowedTypes = ['image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            toast({ variant: 'destructive', title: 'Tipo de arquivo inválido', description: 'Por favor, selecione um arquivo JPG ou PNG.' });
            return;
        }
        
        setIsUploading(true);
        try {
            const companyRef = doc(db, `users/${user.uid}/companies`, activeCompanyId);
            const logoPath = `users/${user.uid}/companies/${activeCompanyId}/logo/${file.name}`;
            const storageRef = ref(storage, logoPath);
            
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            await updateDoc(companyRef, { logoUrl: downloadURL, logoPath: logoPath });
            form.setValue('logoUrl', downloadURL);
            form.setValue('logoPath', logoPath);

            toast({ title: 'Logomarca enviada com sucesso!' });
        } catch(error) {
            console.error('Error uploading logo:', error);
            toast({ variant: 'destructive', title: 'Erro ao enviar logomarca.' });
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleDeleteLogo = async () => {
        if (!user || !activeCompanyId || !form.getValues('logoPath')) return;
        
        const logoPath = form.getValues('logoPath');
        if (!logoPath) return;

        setIsUploading(true);
        try {
            const storageRef = ref(storage, logoPath);
            await deleteObject(storageRef);

            const companyRef = doc(db, `users/${user.uid}/companies`, activeCompanyId);
            await updateDoc(companyRef, { logoUrl: null, logoPath: null });
            
            form.setValue('logoUrl', null);
            form.setValue('logoPath', null);
            
            toast({ title: 'Logomarca removida com sucesso!' });
        } catch (error) {
            console.error('Error deleting logo:', error);
            toast({ variant: 'destructive', title: 'Erro ao remover logomarca.' });
        } finally {
            setIsUploading(false);
        }
    }


    const handleSaveEstablishment = (data: EstablishmentData) => {
        setEstablishmentData(data);
        setEstablishmentModalOpen(false);
    };

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
                                        <FormLabel>Razão Social / Nome Completo</FormLabel>
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
                                        <FormLabel>Nome Fantasia (opcional)</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="tipoInscricao"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                    <FormLabel>Tipo de Inscrição</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            form.setValue('inscricao', ''); // Clear field on change
                                        }}
                                        defaultValue={field.value}
                                        className="flex space-x-4"
                                        >
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="cnpj" /></FormControl>
                                            <FormLabel className="font-normal">CNPJ</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="cpf" /></FormControl>
                                            <FormLabel className="font-normal">CPF</FormLabel>
                                        </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="inscricao"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tipoInscricao === 'cnpj' ? 'CNPJ' : 'CPF'}</FormLabel>
                                        <div className="relative">
                                            <FormControl>
                                                <Input 
                                                    {...field}
                                                    placeholder={tipoInscricao === 'cnpj' ? '00.000.000/0001-00' : '000.000.000-00'}
                                                    onChange={(e) => {
                                                        const { value } = e.target;
                                                        if (tipoInscricao === 'cnpj') {
                                                            e.target.value = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
                                                        } else {
                                                            e.target.value = value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                                                        }
                                                        field.onChange(e);
                                                    }}
                                                    onBlur={tipoInscricao === 'cnpj' ? handleCnpjLookup : undefined}
                                                />
                                            </FormControl>
                                            {tipoInscricao === 'cnpj' && (
                                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                                    {loadingCnpj ? (
                                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                    ) : (
                                                        <Search className="h-5 w-5 text-muted-foreground cursor-pointer" onClick={handleCnpjLookup} />
                                                    )}
                                                </div>
                                            )}
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
                                                <SelectItem value="mei">Microempreendedor Individual (MEI)</SelectItem>
                                                <SelectItem value="nao-lucrativo-igreja">Sem Fins Lucrativos (Igreja)</SelectItem>
                                                <SelectItem value="nao-lucrativo-cooperativa">Sem Fins Lucrativos (Cooperativa)</SelectItem>
                                                <SelectItem value="nao-lucrativo-associacao">Sem Fins Lucrativos (Associação)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="cnaePrincipalCodigo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Código da Atividade Principal</FormLabel>
                                        <FormControl><Input {...field} readOnly={tipoInscricao === 'cnpj'} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="cnaePrincipalDescricao"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Descrição da Atividade Principal</FormLabel>
                                        <FormControl><Input {...field} readOnly={tipoInscricao === 'cnpj'} /></FormControl>
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
                            <CardTitle>Logomarca da Empresa</CardTitle>
                            <CardDescription>Faça o upload da logomarca da sua empresa para personalizar relatórios.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2">
                             <div>
                                 <FormLabel>Arquivo da Logomarca (PNG, JPG)</FormLabel>
                                 <div className="flex items-center gap-4 mt-2">
                                    <Input id="logo-upload" type="file" accept="image/png, image/jpeg" onChange={handleLogoUpload} className="hidden" disabled={isUploading} />
                                    <Button type="button" onClick={() => document.getElementById('logo-upload')?.click()} disabled={isUploading}>
                                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                                        {logoUrl ? 'Trocar Logomarca' : 'Enviar Logomarca'}
                                    </Button>
                                    {logoUrl && (
                                        <Button type="button" variant="destructive" onClick={handleDeleteLogo} disabled={isUploading}>
                                             {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                                             Remover
                                        </Button>
                                    )}
                                 </div>
                             </div>
                             <div className="flex items-center justify-center p-4 border rounded-md bg-muted h-32">
                                {isUploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : logoUrl ? <Image src={logoUrl} alt="Logomarca da empresa" width={120} height={120} className="object-contain h-full" /> : <p className="text-sm text-muted-foreground">Prévia da logomarca</p>}
                             </div>
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
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Segurança e Períodos Fiscais</CardTitle>
                            <CardDescription>Gerencie o fechamento de períodos fiscais para garantir a integridade dos dados.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button type="button" variant="destructive" onClick={() => setReopenPeriodModalOpen(true)}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                Reabrir Período Fiscal Fechado
                            </Button>
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
        {user && activeCompanyId && (
            <EstablishmentForm 
                isOpen={isEstablishmentModalOpen}
                onClose={() => setEstablishmentModalOpen(false)}
                userId={user.uid}
                companyId={activeCompanyId}
                initialData={establishmentData}
                onSave={handleSaveEstablishment}
            />
        )}
         {user && activeCompanyId && (
            <ReopenPeriodModal
                isOpen={isReopenPeriodModalOpen}
                onClose={() => setReopenPeriodModalOpen(false)}
                userId={user.uid}
                companyId={activeCompanyId}
            />
        )}
    </div>
  );
}
