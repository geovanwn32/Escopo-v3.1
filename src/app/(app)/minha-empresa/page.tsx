
"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase.tsx";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Save, Loader2, Search, FileKey, KeyRound, Upload, Trash2, UploadCloud, File as FileIcon, X, Archive, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { EstablishmentForm } from "@/components/empresa/establishment-form";
import type { Company, EstablishmentData } from '@/types/company';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ReopenPeriodModal } from "@/components/fiscal/reopen-period-modal";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { BackupModal } from "@/components/empresa/backup-modal";
import { lookupCnpj } from "@/services/data-lookup-service";
import { v4 as uuidv4 } from 'uuid';


const companySchema = z.object({
  razaoSocial: z.string().min(1, "Razão Social é obrigatória."),
  nomeFantasia: z.string().optional(),
  tipoInscricao: z.enum(['cnpj', 'cpf']),
  inscricao: z.string().min(1, "CNPJ/CPF é obrigatório"),
  pseudoIp: z.string().optional(),
  ativo: z.boolean().default(true),
  tipoEstabelecimento: z.enum(['matriz', 'filial']).default('matriz'),
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
  licenseType: z.enum(['basica', 'profissional', 'premium']).default('basica'),
  metodoApropriacaoCredito: z.string().optional(),
  tipoContribuicao: z.string().optional(),
  incidenciaTributaria: z.string().optional(),
  apuracaoPisCofins: z.string().optional(),
}).superRefine((data, ctx) => {
    const { tipoInscricao, inscricao } = data;
    const cleanedInscricao = inscricao ? inscricao.replace(/\D/g, '') : '';

    if (tipoInscricao === 'cnpj' && cleanedInscricao.length !== 14) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "CNPJ inválido. Deve conter 14 dígitos.",
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

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function MinhaEmpresaPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [loadingPage, setLoadingPage] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [establishmentData, setEstablishmentData] = useState<EstablishmentData | null>(null);
    const [isEstablishmentModalOpen, setEstablishmentModalOpen] = useState(false);
    const [isReopenPeriodModalOpen, setReopenPeriodModalOpen] = useState(false);
    const [isBackupModalOpen, setBackupModalOpen] = useState(false);

    // Logo upload state
    const [isDragging, setIsDragging] = useState(false);
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loadingCnpj, setLoadingCnpj] = useState(false);

    const form = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema),
    });
    
    const tipoInscricao = form.watch('tipoInscricao');
    const logoUrl = form.watch('logoUrl');

    const handleCnpjLookup = async () => {
        const cnpjValue = form.getValues("inscricao");
        if (!cnpjValue || cnpjValue.replace(/\D/g, '').length !== 14) {
            toast({ variant: 'destructive', title: 'CNPJ inválido para busca.' });
            return;
        }

        setLoadingCnpj(true);
        try {
            const data = await lookupCnpj(cnpjValue);
            form.setValue('razaoSocial', data.razaoSocial, { shouldValidate: true });
            form.setValue('nomeFantasia', data.nomeFantasia, { shouldValidate: true });
            form.setValue('cnaePrincipalCodigo', data.cnaePrincipal, { shouldValidate: true });
            form.setValue('cnaePrincipalDescricao', data.cnaePrincipalDescricao, { shouldValidate: true });
            form.setValue('inscricaoEstadual', data.inscricaoEstadual, { shouldValidate: true });
            form.setValue('cep', data.cep, { shouldValidate: true });
            form.setValue('logradouro', data.logradouro, { shouldValidate: true });
            form.setValue('numero', data.numero, { shouldValidate: true });
            form.setValue('bairro', data.bairro, { shouldValidate: true });
            form.setValue('cidade', data.cidade, { shouldValidate: true });
            form.setValue('uf', data.uf, { shouldValidate: true });
            form.setValue('email', data.email, { shouldValidate: true });
            form.setValue('telefone', data.telefone, { shouldValidate: true });

            toast({ title: 'Dados do CNPJ preenchidos!' });
        } catch (error) {
            console.error("Lookup failed:", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar CNPJ', description: (error as Error).message });
        } finally {
            setLoadingCnpj(false);
        }
    };

    const handleCepLookup = async (cep: string) => {
        const cleanedCep = cep.replace(/\D/g, '');
        if (cleanedCep.length !== 8) return;

        setLoadingCnpj(true); // Re-use loading state
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
            if (!response.ok) throw new Error('CEP não encontrado');
            const data = await response.json();
            if (data.erro) throw new Error('CEP inválido');
            
            form.setValue('logradouro', data.logradouro);
            form.setValue('bairro', data.bairro);
            form.setValue('cidade', data.localidade);
            form.setValue('uf', data.uf);
            form.setFocus('numero'); // Move focus to the number field
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao buscar CEP', description: (error as Error).message });
        } finally {
            setLoadingCnpj(false);
        }
    };


    useEffect(() => {
        if (typeof window !== 'undefined') {
            const companyId = sessionStorage.getItem('activeCompanyId');
            if (companyId && user) {
                const fetchCompanyData = async () => {
                    const companyRef = doc(db, `users/${user.uid}/companies`, companyId);
                    const establishmentRef = doc(db, `users/${user.uid}/companies/${companyId}/esocial`, 'establishment');
                    
                    const [companySnap, establishmentSnap] = await Promise.all([getDoc(companyRef), getDoc(establishmentRef)]);

                    if (companySnap.exists()) {
                        let data = companySnap.data() as Partial<CompanyFormData> & {cnpj?: string, cpf?: string, pseudoIp?: string};

                        // Check and generate pseudoIp if it doesn't exist
                        if (!data.pseudoIp) {
                            const newPseudoIp = uuidv4();
                            try {
                                await updateDoc(companyRef, { pseudoIp: newPseudoIp });
                                data.pseudoIp = newPseudoIp; // Update local data object
                                toast({ title: "Identificador Único Gerado", description: "Um identificador único foi atribuído a esta empresa." });
                            } catch (e) {
                                console.error("Failed to update company with pseudoIp:", e);
                            }
                        }

                        setActiveCompany({ id: companySnap.id, ...data } as Company);

                        const inscricaoValue = data.cnpj || data.cpf || data.inscricao;
                        let formattedInscricao = inscricaoValue || "";
                        if (inscricaoValue) {
                            if (data.tipoInscricao === 'cnpj' || (!data.tipoInscricao && inscricaoValue?.length > 11)) {
                                formattedInscricao = inscricaoValue.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
                            } else if (data.tipoInscricao === 'cpf') {
                                formattedInscricao = inscricaoValue.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                            }
                        }
                        
                        form.reset({
                          razaoSocial: data.razaoSocial ?? '',
                          nomeFantasia: data.nomeFantasia ?? '',
                          tipoInscricao: data.tipoInscricao ?? 'cnpj',
                          inscricao: formattedInscricao,
                          pseudoIp: data.pseudoIp ?? '',
                          ativo: data.ativo ?? true,
                          tipoEstabelecimento: data.tipoEstabelecimento ?? ('isMatriz' in data ? (data.isMatriz ? 'matriz' : 'filial') : 'matriz'),
                          cnaePrincipalCodigo: data.cnaePrincipalCodigo ?? '',
                          cnaePrincipalDescricao: data.cnaePrincipalDescricao ?? '',
                          regimeTributario: data.regimeTributario ?? '',
                          inscricaoEstadual: data.inscricaoEstadual ?? '',
                          inscricaoMunicipal: data.inscricaoMunicipal ?? '',
                          cep: data.cep ?? '',
                          logradouro: data.logradouro ?? '',
                          numero: data.numero ?? '',
                          complemento: data.complemento ?? '',
                          bairro: data.bairro ?? '',
                          cidade: data.cidade ?? '',
                          uf: data.uf ?? '',
                          telefone: data.telefone ?? '',
                          email: data.email ?? '',
                          logoUrl: data.logoUrl ?? null,
                          logoPath: data.logoPath ?? null,
                          licenseType: data.licenseType ?? 'basica',
                          metodoApropriacaoCredito: data.metodoApropriacaoCredito ?? '1',
                          tipoContribuicao: data.tipoContribuicao ?? '1',
                          incidenciaTributaria: data.incidenciaTributaria ?? '1',
                          apuracaoPisCofins: data.apuracaoPisCofins ?? '1',
                        });
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
        }
    }, [user, form, toast]);


    async function onSubmit(data: CompanyFormData) {
        if (!user || !activeCompany) {
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
            
            const companyRef = doc(db, `users/${user.uid}/companies`, activeCompany.id);
            await setDoc(companyRef, dataToSave, { merge: true });
            
            const updatedCompanyDataForSession = { id: activeCompany.id, ...dataToSave };
            sessionStorage.setItem(`company_${activeCompany.id}`, JSON.stringify(updatedCompanyDataForSession));

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
    
    // --- Logo Upload handlers ---
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };

    const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelection = (file: File) => {
        const allowedTypes = ['image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            toast({ variant: 'destructive', title: 'Tipo de arquivo inválido', description: 'Por favor, selecione um arquivo JPG ou PNG.' });
            return;
        }
        setFileToUpload(file);
    };

    const handleManualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelection(e.target.files[0]);
        }
    };

    const handleLogoUpload = async () => {
        if (!fileToUpload || !user || !activeCompany) return;
        
        setIsUploading(true);
        try {
            const companyRef = doc(db, `users/${user.uid}/companies`, activeCompany.id);
            const logoPath = `users/${user.uid}/companies/${activeCompany.id}/logo/${fileToUpload.name}`;
            const storageRef = ref(storage, logoPath);
            
            await uploadBytes(storageRef, fileToUpload);
            const downloadURL = await getDownloadURL(storageRef);

            await setDoc(companyRef, { logoUrl: downloadURL, logoPath: logoPath }, { merge: true });
            form.setValue('logoUrl', downloadURL);
            form.setValue('logoPath', logoPath);

            toast({ title: 'Logomarca enviada com sucesso!' });
            setFileToUpload(null);
        } catch(error) {
            console.error('Error uploading logo:', error);
            toast({ variant: 'destructive', title: 'Erro ao enviar logomarca.' });
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleDeleteLogo = async () => {
        if (!user || !activeCompany || !form.getValues('logoPath')) return;
        
        const logoPath = form.getValues('logoPath');
        if (!logoPath) return;

        setIsUploading(true);
        try {
            const storageRef = ref(storage, logoPath);
            await deleteObject(storageRef);

            const companyRef = doc(db, `users/${user.uid}/companies`, activeCompany.id);
            await setDoc(companyRef, { logoUrl: null, logoPath: null }, { merge: true });
            
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

  if (!activeCompany) {
      return (
          <div className="flex h-full w-full items-center justify-center">
              <p>Nenhuma empresa selecionada. Por favor, selecione uma empresa no menu superior.</p>
          </div>
      )
  }

  return (
    <div className="space-y-6">
        <input type="file" ref={fileInputRef} onChange={handleManualFileSelect} className="hidden" accept="image/png, image/jpeg" />
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Configurações da Empresa</h1>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEstablishmentModalOpen(true)}><FileKey className="mr-2 h-4 w-4"/>Ficha do Estabelecimento (eSocial)</Button>
                <Button variant="outline" onClick={() => setReopenPeriodModalOpen(true)}><KeyRound className="mr-2 h-4 w-4"/>Reabrir Período Fiscal</Button>
                <Button variant="secondary" onClick={() => setBackupModalOpen(true)}><Archive className="mr-2 h-4 w-4"/>Backup e Restauração</Button>
            </div>
        </div>
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
                            <div className="grid grid-cols-2 gap-4">
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
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (tipoInscricao === 'cnpj') handleCnpjLookup();
                                                            }
                                                        }}
                                                        onChange={(e) => {
                                                            const { value } = e.target;
                                                            if (tipoInscricao === 'cnpj') {
                                                                e.target.value = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
                                                            } else {
                                                                e.target.value = value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                                                            }
                                                            field.onChange(e);
                                                        }}
                                                    />
                                                </FormControl>
                                                {tipoInscricao === 'cnpj' && (
                                                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleCnpjLookup} disabled={loadingCnpj}>
                                                        {loadingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 text-muted-foreground" />}
                                                    </Button>
                                                )}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="pseudoIp"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Identificador Único (IP)</FormLabel>
                                            <FormControl>
                                                <Input {...field} readOnly className="italic text-muted-foreground font-mono" />
                                            </FormControl>
                                            <FormDescription className="flex items-center gap-1 text-xs"><Info className="h-3 w-3"/> Este ID é gerado pelo sistema.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="tipoEstabelecimento"
                                render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Tipo de Estabelecimento</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        className="flex flex-row space-x-4 rounded-lg border p-4"
                                        >
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value="matriz" />
                                                </FormControl>
                                                <FormLabel className="font-normal">Matriz</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value="filial" />
                                                </FormControl>
                                                <FormLabel className="font-normal">Filial</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="ativo"
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                    <FormLabel className="text-base">Empresa Ativa</FormLabel>
                                    <FormDescription>
                                        Empresas inativas não aparecerão em listas de seleção.
                                    </FormDescription>
                                    </div>
                                    <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                    </FormControl>
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
                                name="licenseType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Licença</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione a licença" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="basica">Básica</SelectItem>
                                                <SelectItem value="profissional">Profissional</SelectItem>
                                                <SelectItem value="premium">Premium</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField control={form.control} name="cnaePrincipalCodigo" render={({ field }) => ( <FormItem><FormLabel>Código da Atividade Principal</FormLabel><FormControl><Input {...field} readOnly={tipoInscricao === 'cnpj'} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="cnaePrincipalDescricao" render={({ field }) => ( <FormItem><FormLabel>Descrição da Atividade Principal</FormLabel><FormControl><Input {...field} readOnly={tipoInscricao === 'cnpj'} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="inscricaoEstadual" render={({ field }) => ( <FormItem><FormLabel>Inscrição Estadual</FormLabel><div className="relative"><FormControl><Input {...field} /></FormControl></div><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="inscricaoMunicipal" render={({ field }) => ( <FormItem><FormLabel>Inscrição Municipal</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle>Configurações EFD Contribuições</CardTitle>
                            <CardDescription>Parâmetros para a geração do arquivo EFD Contribuições.</CardDescription>
                        </CardHeader>
                         <CardContent className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="incidenciaTributaria"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Incidência tributária do PIS/COFINS</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">1 - Exclusivamente no regime não-cumulativo</SelectItem>
                                                <SelectItem value="2">2 - Exclusivamente no regime cumulativo</SelectItem>
                                                <SelectItem value="3">3 - Regimes não-cumulativo e cumulativo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="apuracaoPisCofins"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de apuração PIS/COFINS</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">1 - Apuração a Alíquota Básica</SelectItem>
                                                <SelectItem value="2">2 - Apuração a Alíquotas Diferenciadas</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="metodoApropriacaoCredito"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Método de apropriação de créditos</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">1 - Método de Apropriação Direta</SelectItem>
                                                <SelectItem value="2">2 - Método de Rateio Proporcional (Receita Bruta)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="tipoContribuicao"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de contribuição apurada</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">1 - Apuração Exclusivamente a Alíquota Básica</SelectItem>
                                                <SelectItem value="2">2 - Apuração a Alíquotas Específicas</SelectItem>
                                            </SelectContent>
                                        </Select>
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
                         <CardContent className="space-y-4">
                            <div
                                className={cn(
                                "border-2 border-dashed border-muted-foreground/30 rounded-lg p-10 text-center transition-colors cursor-pointer",
                                isDragging && "border-primary bg-primary/10"
                                )}
                                onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                                    <UploadCloud className="h-10 w-10" />
                                    <div>
                                        <p className="font-semibold text-foreground">Arraste a logomarca aqui</p>
                                        <p className="text-sm">ou clique para selecionar (PNG, JPG)</p>
                                    </div>
                                </div>
                            </div>

                            {fileToUpload && !isUploading && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium">Arquivo na Fila:</h4>
                                    <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                                        <div className="flex items-center gap-3">
                                            <FileIcon className="h-5 w-5 text-muted-foreground"/>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{fileToUpload.name}</span>
                                                <span className="text-xs text-muted-foreground">{formatBytes(fileToUpload.size)}</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFileToUpload(null)}>
                                            <X className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                    <Button onClick={handleLogoUpload} disabled={isUploading} className="w-full">
                                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                                        Enviar Arquivo
                                    </Button>
                                </div>
                            )}

                             <div className="flex items-center justify-center p-4 border rounded-md bg-muted h-32">
                                {isUploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : logoUrl ? (
                                    <div className="relative group">
                                         <Image src={logoUrl} alt="Logomarca da empresa" width={120} height={120} className="object-contain h-full" />
                                         <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleDeleteLogo}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                ) : <p className="text-sm text-muted-foreground">Prévia da logomarca</p>}
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
                                        <FormControl><Input {...field} onBlur={(e) => handleCepLookup(e.target.value)} /></FormControl>
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
                        <Button type="submit" disabled={isSaving || loadingPage}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                            Salvar Todas as Alterações
                        </Button>
                    </div>
                </div>
            </form>
        </Form>
        {user && activeCompany && (
            <EstablishmentForm
                isOpen={isEstablishmentModalOpen}
                onClose={() => setEstablishmentModalOpen(false)}
                userId={user.uid}
                companyId={activeCompany.id}
                initialData={establishmentData}
                onSave={handleSaveEstablishment}
            />
        )}
        {user && activeCompany && (
            <ReopenPeriodModal 
                isOpen={isReopenPeriodModalOpen}
                onClose={() => setReopenPeriodModalOpen(false)}
                userId={user.uid}
                companyId={activeCompany.id}
            />
        )}
         {user && activeCompany && (
            <BackupModal 
                isOpen={isBackupModalOpen}
                onClose={() => setBackupModalOpen(false)}
                userId={user.uid}
                companyId={activeCompany.id}
            />
        )}
    </div>
  );
}

    

    