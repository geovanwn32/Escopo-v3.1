
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Search } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Partner, PartnerType } from '@/types/partner';

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
  razaoSocial: z.string().min(1, "Razão Social/Nome é obrigatório"),
  nomeFantasia: z.string().optional(),
  cpfCnpj: z.string().min(1, "CPF/CNPJ é obrigatório").refine(val => {
    const cleaned = val.replace(/\D/g, '');
    return cleaned.length === 11 || cleaned.length === 14;
  }, "CPF/CNPJ inválido"),
  inscricaoEstadual: z.string().optional(),
  
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
});

type FormData = z.infer<typeof partnerSchema>;

const formatCpfCnpj = (value: string = '') => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 11) {
    return cleaned
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return cleaned
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

const formatCep = (cep: string = '') => cep?.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, "$1-$2");

const defaultFormValues: FormData = {
    razaoSocial: '', nomeFantasia: '', cpfCnpj: '', inscricaoEstadual: '',
    cep: '', logradouro: '', numero: '', complemento: '',
    bairro: '', cidade: '', uf: '', email: '', telefone: '',
};

function PartnerForm({ userId, companyId, partner, partnerType, onClose }: Omit<PartnerFormModalProps, 'isOpen'>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const { toast } = useToast();
  
  const mode = partner ? 'edit' : 'create';
  
  const form = useForm<FormData>({
    resolver: zodResolver(partnerSchema),
    defaultValues: mode === 'create'
        ? defaultFormValues
        : {
            ...partner,
            razaoSocial: partner?.razaoSocial || '',
            nomeFantasia: partner?.nomeFantasia || '',
            cpfCnpj: formatCpfCnpj(partner?.cpfCnpj || ''),
            inscricaoEstadual: partner?.inscricaoEstadual || '',
            cep: partner?.cep ? formatCep(partner.cep) : '',
            logradouro: partner?.logradouro || '',
            numero: partner?.numero || '',
            complemento: partner?.complemento || '',
            bairro: partner?.bairro || '',
            cidade: partner?.cidade || '',
            uf: partner?.uf || '',
            email: partner?.email || '',
            telefone: partner?.telefone || '',
        }
  });
  
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
    try {
      const dataToSave = { ...values, type: partnerType, cpfCnpj: values.cpfCnpj.replace(/\D/g, '') };
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
                  <FormField control={form.control} name="razaoSocial" render={({ field }) => ( <FormItem><FormLabel>Razão Social / Nome</FormLabel><FormControl><Input {...field} autoFocus value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="nomeFantasia" render={({ field }) => ( <FormItem><FormLabel>Nome Fantasia (Opcional)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                  <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="cpfCnpj" render={({ field }) => ( 
                        <FormItem>
                            <FormLabel>CPF / CNPJ</FormLabel>
                            <div className="relative">
                                <FormControl><Input {...field} onChange={e => field.onChange(formatCpfCnpj(e.target.value))} maxLength={18} value={field.value || ''} /></FormControl>
                            </div>
                            <FormMessage />
                        </FormItem> 
                      )} />
                      <FormField control={form.control} name="inscricaoEstadual" render={({ field }) => ( <FormItem><FormLabel>Inscrição Estadual (Opcional)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
              </TabsContent>
              <TabsContent value="address" className="space-y-4">
                 <FormField control={form.control} name="cep" render={({ field }) => ( <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} onChange={(e) => {
                     field.onChange(formatCep(e.target.value));
                     if(e.target.value.replace(/\D/g, '').length === 8) handleCepLookup(e.target.value);
                  }} maxLength={9} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                 <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="logradouro" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Logradouro</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="numero" render={({ field }) => ( <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                 </div>
                 <FormField control={form.control} name="complemento" render={({ field }) => ( <FormItem><FormLabel>Complemento (Opcional)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                 <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="bairro" render={({ field }) => ( <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="cidade" render={({ field }) => ( <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="uf" render={({ field }) => ( <FormItem><FormLabel>UF</FormLabel><FormControl><Input {...field} maxLength={2} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                 </div>
              </TabsContent>
              <TabsContent value="contact" className="space-y-4">
                  <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email (Opcional)</FormLabel><FormControl><Input type="email" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="telefone" render={({ field }) => ( <FormItem><FormLabel>Telefone (Opcional)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
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
