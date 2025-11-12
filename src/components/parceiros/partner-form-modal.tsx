
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Search } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Partner, PartnerType, RegimeTributario, TipoContribuinteIcms } from '@/types/partner';
import { lookupCnpj } from '@/services/data-lookup-service';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface PartnerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  partner: Partner | null;
  partnerType: PartnerType;
}

const partnerSchema = z.object({
  // Identity
  tipoPessoa: z.enum(['pf', 'pj']),
  razaoSocial: z.string().min(1, "Razão Social/Nome é obrigatório"),
  nomeFantasia: z.string().optional(),
  cpfCnpj: z.string().min(1, "CPF/CNPJ é obrigatório"),
  inscricaoEstadual: z.string().optional(),
  regimeTributario: z.custom<RegimeTributario>().optional(),
  contribuinteIcms: z.custom<TipoContribuinteIcms>().default('9_nao_contribuinte'),
  
  // Address
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),

  // Contact
  email: z.string().email("Email inválido").optional().or(z.literal('')),
  telefone: z.string().optional(),
}).superRefine((data, ctx) => {
    const cleanedCpfCnpj = (data.cpfCnpj || '').replace(/\D/g, '');
    if (data.tipoPessoa === 'pj' && cleanedCpfCnpj.length !== 14) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CNPJ inválido.", path: ["cpfCnpj"]});
    }
    if (data.tipoPessoa === 'pf' && cleanedCpfCnpj.length !== 11) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CPF inválido.", path: ["cpfCnpj"]});
    }
    if (data.tipoPessoa === 'pj' && data.contribuinteIcms === '1_contribuinte' && !data.inscricaoEstadual) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Inscrição Estadual é obrigatória para contribuintes.", path: ["inscricaoEstadual"]});
    }
});


type FormData = z.infer<typeof partnerSchema>;

const formatCpf = (value: string = '') => value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const formatCnpj = (value: string = '') => value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
const formatCep = (cep: string = '') => cep?.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, "$1-$2");

const defaultFormValues: Partial<FormData> = {
    tipoPessoa: 'pj',
    razaoSocial: '', nomeFantasia: '', cpfCnpj: '', inscricaoEstadual: '',
    cep: '', logradouro: '', numero: '', complemento: '',
    bairro: '', cidade: '', uf: '', email: '', telefone: '',
    contribuinteIcms: '9_nao_contribuinte',
    regimeTributario: undefined,
};

function PartnerForm({ userId, companyId, partner, partnerType, onClose }: Omit<PartnerFormModalProps, 'isOpen'>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const { toast } = useToast();
  
  const mode = partner ? 'edit' : 'create';
  
  const form = useForm<FormData>({
    resolver: zodResolver(partnerSchema),
    defaultValues: defaultFormValues as FormData
  });
  
  const tipoPessoa = form.watch('tipoPessoa');

  useEffect(() => {
    form.setValue('cpfCnpj', ''); // Clear CPF/CNPJ when type changes
  }, [tipoPessoa, form]);

  useEffect(() => {
    if (partner) {
      const partnerDataWithDefaults = {
        ...defaultFormValues,
        ...partner,
      };

      // Ensure no null values are passed to the form, which causes uncontrolled component errors.
      const sanitizedPartnerData = Object.fromEntries(
        Object.entries(partnerDataWithDefaults).map(([key, value]) => [key, value === null ? '' : value])
      );
      
      form.reset({
        ...sanitizedPartnerData,
        cpfCnpj: partner.tipoPessoa === 'pf' ? formatCpf(partner?.cpfCnpj || '') : formatCnpj(partner?.cpfCnpj || ''),
        cep: partner?.cep ? formatCep(partner.cep) : '',
      } as FormData);
    } else {
      form.reset(defaultFormValues as FormData);
    }
}, [partner, form]);


  const handleCnpjLookup = async () => {
    const cnpjValue = form.getValues("cpfCnpj");
    if (cnpjValue.replace(/\D/g, '').length !== 14) {
      toast({ variant: 'destructive', title: 'A busca automática funciona apenas para CNPJ.' });
      return;
    }
    setLoadingLookup(true);
    try {
        const data = await lookupCnpj(cnpjValue);
        form.setValue('razaoSocial', data.razaoSocial, { shouldValidate: true });
        form.setValue('nomeFantasia', data.nomeFantasia, { shouldValidate: true });
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
        setLoadingLookup(false);
    }
  };

  
  const handleCepLookup = async (cep: string) => {
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) return;
    setLoadingLookup(true);
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        if (!response.ok) throw new Error('CEP não encontrado');
        const data = await response.json();
        if (data.erro) throw new Error('CEP inválido');
        form.setValue('logradouro', data.logradouro);
        form.setValue('bairro', data.bairro);
        form.setValue('cidade', data.localidade);
        form.setValue('uf', data.uf);
        form.setFocus('numero');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Erro ao buscar CEP', description: (error as Error).message });
    } finally {
        setLoadingLookup(false);
    }
  };

  const onSubmit = async (values: FormData) => {
    setIsSubmitting(true);
    const cleanedCpfCnpj = values.cpfCnpj.replace(/\D/g, '');

    try {
        if (mode === 'create') {
            const partnersRef = collection(db, `users/${userId}/companies/${companyId}/partners`);
            const q = query(partnersRef, where("cpfCnpj", "==", cleanedCpfCnpj));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                toast({
                    variant: "destructive",
                    title: "CPF/CNPJ Duplicado",
                    description: `Já existe um parceiro cadastrado com este CPF/CNPJ.`,
                });
                setIsSubmitting(false);
                return;
            }
        }

      const dataToSave = { 
        ...values, 
        type: partnerType, 
        cpfCnpj: cleanedCpfCnpj,
        regimeTributario: values.regimeTributario || null,
      };
      
      if (mode === 'create') {
        const partnersRef = collection(db, `users/${userId}/companies/${companyId}/partners`);
        await addDoc(partnersRef, dataToSave);
        toast({ title: `${typeLabel} Cadastrado!`, description: `${values.razaoSocial} foi adicionado com sucesso.` });
      } else if (partner?.id) {
        const partnerRef = doc(db, `users/${userId}/companies/${companyId}/partners`, partner.id);
        await setDoc(partnerRef, dataToSave, { merge: true });
        toast({ title: `${typeLabel} Atualizado!`, description: `Os dados de ${values.razaoSocial} foram atualizados.` });
      }
      onClose();
    } catch (error) {
        console.error("Error saving partner:", error);
        toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível salvar os dados do parceiro." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const typeLabel = {
    cliente: 'Cliente',
    fornecedor: 'Fornecedor',
    transportadora: 'Transportadora',
  }[partnerType];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? `Novo ${typeLabel}` : `Editar ${typeLabel}`}</DialogTitle>
        <DialogDescription>Preencha os dados abaixo para cadastrar ou editar.</DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs defaultValue="identity" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="identity">Identificação</TabsTrigger>
              <TabsTrigger value="address">Endereço</TabsTrigger>
              <TabsTrigger value="contact">Contato</TabsTrigger>
            </TabsList>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              <TabsContent value="identity" className="space-y-4">
                 <FormField control={form.control} name="tipoPessoa" render={({ field }) => (
                    <FormItem className="space-y-3"><FormLabel>Tipo de Pessoa</FormLabel>
                        <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4">
                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="pj" /></FormControl><FormLabel className="font-normal">Pessoa Jurídica</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="pf" /></FormControl><FormLabel className="font-normal">Pessoa Física</FormLabel></FormItem>
                            </RadioGroup>
                        </FormControl>
                    <FormMessage /></FormItem>
                 )} />

                  <FormField control={form.control} name="razaoSocial" render={({ field }) => ( <FormItem><FormLabel>{tipoPessoa === 'pj' ? 'Razão Social' : 'Nome Completo'}</FormLabel><FormControl><Input {...field} autoFocus /></FormControl><FormMessage /></FormItem> )} />
                  {tipoPessoa === 'pj' && <FormField control={form.control} name="nomeFantasia" render={({ field }) => ( <FormItem><FormLabel>Nome Fantasia (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />}

                  <FormField control={form.control} name="cpfCnpj" render={({ field }) => ( 
                    <FormItem>
                        <FormLabel>{tipoPessoa === 'pj' ? 'CNPJ' : 'CPF'}</FormLabel>
                        <div className="relative">
                            <FormControl>
                                <Input {...field} onChange={e => field.onChange(tipoPessoa === 'pf' ? formatCpf(e.target.value) : formatCnpj(e.target.value))} maxLength={18} />
                            </FormControl>
                           {tipoPessoa === 'pj' && (
                             <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleCnpjLookup} disabled={loadingLookup}>
                                {loadingLookup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 text-muted-foreground" />}
                             </Button>
                           )}
                        </div>
                        <FormMessage />
                    </FormItem> 
                  )} />
                 {tipoPessoa === 'pj' && (
                    <>
                        <FormField control={form.control} name="contribuinteIcms" render={({ field }) => (
                            <FormItem><FormLabel>Contribuinte de ICMS</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="1_contribuinte">1 - Contribuinte ICMS</SelectItem>
                                        <SelectItem value="2_contribuinte_isento">2 - Contribuinte isento</SelectItem>
                                        <SelectItem value="9_nao_contribuinte">9 - Não Contribuinte</SelectItem>
                                    </SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="inscricaoEstadual" render={({ field }) => ( <FormItem><FormLabel>Inscrição Estadual</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                         <FormField control={form.control} name="regimeTributario" render={({ field }) => (
                            <FormItem><FormLabel>Regime Tributário</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="simples">Simples Nacional</SelectItem>
                                        <SelectItem value="presumido">Lucro Presumido</SelectItem>
                                        <SelectItem value="real">Lucro Real</SelectItem>
                                        <SelectItem value="mei">MEI</SelectItem>
                                    </SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                    </>
                 )}
              </TabsContent>
              <TabsContent value="address" className="space-y-4">
                 <FormField control={form.control} name="cep" render={({ field }) => ( <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} onChange={(e) => {
                     field.onChange(formatCep(e.target.value));
                     if(e.target.value.replace(/\D/g, '').length === 8) handleCepLookup(e.target.value);
                  }} maxLength={9} /></FormControl><FormMessage /></FormItem> )} />
                 <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="logradouro" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Logradouro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="numero" render={({ field }) => ( <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                 </div>
                 <FormField control={form.control} name="complemento" render={({ field }) => ( <FormItem><FormLabel>Complemento (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                 <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="bairro" render={({ field }) => ( <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="cidade" render={({ field }) => ( <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="uf" render={({ field }) => ( <FormItem><FormLabel>UF</FormLabel><FormControl><Input {...field} maxLength={2} /></FormControl><FormMessage /></FormItem> )} />
                 </div>
              </TabsContent>
              <TabsContent value="contact" className="space-y-4">
                  <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email (Opcional)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="telefone" render={({ field }) => ( <FormItem><FormLabel>Telefone (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter className="pt-6">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting || loadingLookup}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || loadingLookup}>
              {(isSubmitting || loadingLookup) && <Loader2 className="animate-spin mr-2" />}
              {mode === 'create' ? `Salvar ${typeLabel}` : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}


export function PartnerFormModal({ isOpen, onClose, userId, companyId, partner, partnerType }: PartnerFormModalProps) {
  const modalKey = `${partner?.id || 'new'}-${partnerType}`;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl" key={modalKey}>
        <PartnerForm 
            userId={userId} 
            companyId={companyId} 
            partner={partner} 
            partnerType={partnerType}
            onClose={onClose} 
        />
      </DialogContent>
    </Dialog>
  );
}
