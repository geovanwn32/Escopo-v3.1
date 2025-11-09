
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import { Switch } from '../ui/switch';
import type { Socio } from '@/types/socio';
import { Timestamp } from 'firebase/firestore';

interface SocioFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  socio: Socio | null;
}

const socioSchema = z.object({
  // Personal Data
  nomeCompleto: z.string().min(1, "Nome é obrigatório"),
  dataNascimento: z.date({ required_error: "Data de nascimento é obrigatória." }),
  cpf: z.string().min(14, "CPF inválido").transform(val => val.replace(/\D/g, '')),
  rg: z.string().min(1, "RG é obrigatório"),
  nis: z.string().optional(),
  estadoCivil: z.string().min(1, "Estado civil é obrigatório"),
  nacionalidade: z.string().min(1, "Nacionalidade é obrigatória"),
  profissao: z.string().min(1, "Profissão é obrigatória"),

  // Address
  cep: z.string().min(9, "CEP inválido").transform(val => val.replace(/\D/g, '')),
  logradouro: z.string().min(1, "Logradouro é obrigatório"),
  numero: z.string().min(1, "Número é obrigatório"),
  complemento: z.string().optional(),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  uf: z.string().length(2, "UF inválida"),
  
  // Contact
  email: z.string().email("Email inválido").optional().or(z.literal('')),
  telefone: z.string().min(10, "Telefone inválido"),
  
  // Corporate Data
  dataEntrada: z.date({ required_error: "Data de entrada é obrigatória." }),
  participacao: z.string().min(1, "Participação é obrigatória").transform(v => String(v).replace(',', '.')),
  proLabore: z.string().min(1, "Pró-labore é obrigatório").transform(v => String(v).replace(',', '.')),
  isAdministrador: z.boolean().default(false),
});

type FormData = z.infer<typeof socioSchema>;

const formatCpf = (cpf: string) => cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const formatCep = (cep: string) => cep?.replace(/(\d{5})(\d{3})/, "$1-$2");

const defaultFormValues: FormData = {
    nomeCompleto: '',
    dataNascimento: new Date(),
    cpf: '',
    rg: '',
    nis: '',
    nacionalidade: "Brasileiro(a)",
    profissao: "Sócio",
    estadoCivil: "solteiro",
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    email: '',
    telefone: '',
    dataEntrada: new Date(),
    participacao: "100",
    proLabore: "0",
    isAdministrador: true,
};


function SocioForm({ userId, companyId, socio, onClose }: Omit<SocioFormModalProps, 'isOpen'>) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const mode = socio ? 'edit' : 'create';
    
    const form = useForm<FormData>({
        resolver: zodResolver(socioSchema),
        defaultValues: defaultFormValues,
    });

     useEffect(() => {
        if (socio) {
            form.reset({
                ...socio,
                cpf: formatCpf(socio?.cpf || ''),
                cep: formatCep(socio?.cep || ''),
                participacao: String(socio?.participacao || ''),
                proLabore: String(socio?.proLabore || ''),
                dataNascimento: socio.dataNascimento instanceof Timestamp ? socio.dataNascimento.toDate() : socio.dataNascimento,
                dataEntrada: socio.dataEntrada instanceof Timestamp ? socio.dataEntrada.toDate() : socio.dataEntrada,
                isAdministrador: socio?.isAdministrador ?? false,
            });
        } else {
            form.reset(defaultFormValues);
        }
    }, [socio, form]);


    const handleCepLookup = async (cep: string) => {
        const cleanedCep = cep.replace(/\D/g, '');
        if (cleanedCep.length !== 8) return;

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
            toast({
                variant: 'destructive',
                title: 'Erro ao buscar CEP',
                description: (error as Error).message || 'Não foi possível buscar o endereço.',
            });
        }
    };

    const onSubmit = async (values: FormData) => {
        setLoading(true);
        const cleanedCpf = values.cpf.replace(/\D/g, '');
        try {
        if (mode === 'create') {
            const sociosRef = collection(db, `users/${userId}/companies/${companyId}/socios`);
            const q = query(sociosRef, where("cpf", "==", cleanedCpf));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                toast({
                    variant: "destructive",
                    title: "CPF Duplicado",
                    description: `Já existe um sócio cadastrado com este CPF.`,
                });
                return;
            }
        }
            
        const dataToSave = { 
            ...values,
            cpf: cleanedCpf,
            participacao: parseFloat(values.participacao),
            proLabore: parseFloat(values.proLabore) 
        };
        
        if (mode === 'create') {
            const sociosRef = collection(db, `users/${userId}/companies/${companyId}/socios`);
            await addDoc(sociosRef, dataToSave);
            toast({
            title: "Sócio Cadastrado!",
            description: `${values.nomeCompleto} foi adicionado com sucesso.`,
            });
        } else if (socio?.id) {
            const socioRef = doc(db, `users/${userId}/companies/${companyId}/socios`, socio.id);
            await setDoc(socioRef, dataToSave);
            toast({
            title: "Sócio Atualizado!",
            description: `Os dados de ${values.nomeCompleto} foram atualizados.`,
            });
        }
        
        onClose();
        } catch (error) {
            console.error("Error saving socio:", error);
            toast({
                variant: "destructive",
                title: "Erro ao salvar",
                description: "Não foi possível salvar os dados do sócio."
            });
        } finally {
            setLoading(false);
        }
    };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? 'Cadastro de Novo Sócio' : 'Alterar Sócio'}</DialogTitle>
        <DialogDescription>
            {mode === 'create' 
            ? "Preencha os dados abaixo para adicionar um novo sócio."
            : `Alterando os dados de ${socio?.nomeCompleto}.`
            }
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="personal">Dados Pessoais</TabsTrigger>
                <TabsTrigger value="address">Endereço</TabsTrigger>
                <TabsTrigger value="corporate">Dados Societários</TabsTrigger>
            </TabsList>
            
            <div className="max-h-[60vh] overflow-y-auto p-4">
                <TabsContent value="personal" className="space-y-4">
                <FormField control={form.control} name="nomeCompleto" render={({ field }) => ( <FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="dataNascimento" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data de Nascimento</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="cpf" render={({ field }) => ( <FormItem><FormLabel>CPF</FormLabel><FormControl><Input {...field} onChange={(e) => {
                    const { value } = e.target;
                    e.target.value = value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                    field.onChange(e);
                    }} maxLength={14} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="rg" render={({ field }) => ( <FormItem><FormLabel>RG</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="nis" render={({ field }) => ( <FormItem><FormLabel>NIT/PIS (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="estadoCivil" render={({ field }) => ( <FormItem><FormLabel>Estado Civil</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="solteiro">Solteiro(a)</SelectItem><SelectItem value="casado">Casado(a)</SelectItem><SelectItem value="divorciado">Divorciado(a)</SelectItem><SelectItem value="viuvo">Viúvo(a)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="nacionalidade" render={({ field }) => ( <FormItem><FormLabel>Nacionalidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="profissao"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Profissão</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="Sócio">Sócio</SelectItem>
                            <SelectItem value="Titular">Titular</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="telefone" render={({ field }) => ( <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                 <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email (Opcional)</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem> )} />
                </TabsContent>

                <TabsContent value="address" className="space-y-4">
                <FormField control={form.control} name="cep" render={({ field }) => ( <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} onChange={(e) => {
                    const { value } = e.target;
                    e.target.value = value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2');
                    field.onChange(e);
                    if(e.target.value.length === 9) handleCepLookup(e.target.value)
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

                <TabsContent value="corporate" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="dataEntrada" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data de Entrada na Sociedade</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="participacao" render={({ field }) => ( <FormItem><FormLabel>Participação Societária (%)</FormLabel><FormControl><Input {...field} type="number" step="0.01" /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <FormField control={form.control} name="proLabore" render={({ field }) => ( <FormItem><FormLabel>Valor do Pró-labore (R$)</FormLabel><FormControl><Input {...field} onChange={e => {
                        const { value } = e.target;
                        e.target.value = value.replace(/[^0-9,.]/g, '').replace('.', ',');
                        field.onChange(e);
                    }} /></FormControl><FormDescription>Informe 0 (zero) caso não haja retirada.</FormDescription><FormMessage /></FormItem> )} />
                <FormField
                    control={form.control}
                    name="isAdministrador"
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                        <FormLabel className="text-base">Sócio Administrador</FormLabel>
                        <FormDescription>
                            Marque se este sócio tem poderes para administrar a empresa.
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
                </TabsContent>
            </div>

            </Tabs>
            <DialogFooter className="pt-6">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Save />}
                {mode === 'create' ? 'Salvar Sócio' : 'Salvar Alterações'}
            </Button>
            </DialogFooter>
        </form>
        </Form>
    </>
  );
}


export function SocioFormModal({ isOpen, onClose, userId, companyId, socio }: SocioFormModalProps) {
  const modalKey = socio?.id || 'new-socio';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl" key={modalKey}>
        <SocioForm 
            userId={userId} 
            companyId={companyId} 
            socio={socio} 
            onClose={onClose} 
        />
      </DialogContent>
    </Dialog>
  );
}
