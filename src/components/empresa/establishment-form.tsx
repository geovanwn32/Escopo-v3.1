
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import type { EstablishmentData } from "@/types/company";
import { Separator } from "../ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface EstablishmentFormProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    companyId: string;
    initialData: EstablishmentData | null;
    onSave: (data: EstablishmentData) => void;
}

const establishmentSchema = z.object({
  aliqRat: z.coerce.number().min(0, "Valor inválido").max(3, "Valor máximo é 3"),
  fap: z.coerce.number().min(0.5, "Valor mínimo é 0.5").max(2, "Valor máximo é 2"),
  nrInscApr: z.string().optional(),
  nrCaepf: z.string().optional(),
  contrataPCD: z.boolean().default(false),
  contatoNome: z.string().min(1, "Nome do contato é obrigatório"),
  contatoCpf: z.string().length(11, "CPF deve ter 11 dígitos").transform(val => val.replace(/\D/g, '')),
  contatoFone: z.string().min(10, "Telefone inválido"),
  softwareHouseCnpj: z.string().length(14, "CNPJ deve ter 14 dígitos").transform(val => val.replace(/\D/g, '')),
  softwareHouseRazaoSocial: z.string().min(1, "Razão Social é obrigatória"),
  softwareHouseNomeContato: z.string().min(1, "Nome do contato é obrigatório"),
  softwareHouseTelefone: z.string().min(10, "Telefone inválido"),
  situacaoPj: z.string().min(1, "Situação é obrigatória"),
});

const defaultValues: z.infer<typeof establishmentSchema> = {
    aliqRat: 0,
    fap: 1.0,
    nrInscApr: "",
    nrCaepf: "",
    contrataPCD: false,
    contatoNome: "",
    contatoCpf: "",
    contatoFone: "",
    softwareHouseCnpj: "12097670000157",
    softwareHouseRazaoSocial: "DOM SOLUCOES",
    softwareHouseNomeContato: "CLEIB DOMINGOS DE LIMA",
    softwareHouseTelefone: "6241011972",
    situacaoPj: "0",
};


export function EstablishmentForm({ isOpen, onClose, userId, companyId, initialData, onSave }: EstablishmentFormProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const form = useForm<z.infer<typeof establishmentSchema>>({
        resolver: zodResolver(establishmentSchema),
        defaultValues,
    });

    useEffect(() => {
        if (initialData) {
            form.reset(initialData);
        } else {
            form.reset(defaultValues);
        }
    }, [initialData, form]);

    const handleSubmit = async (values: z.infer<typeof establishmentSchema>) => {
        setLoading(true);
        try {
            const establishmentRef = doc(db, `users/${userId}/companies/${companyId}/esocial`, 'establishment');
            await setDoc(establishmentRef, values, { merge: true });
            
            toast({
                title: "Dados do Estabelecimento Salvos!",
                description: "As informações para o eSocial foram atualizadas.",
            });
            onSave(values);
        } catch (error) {
            console.error("Error saving establishment data:", error);
            toast({
                variant: "destructive",
                title: "Erro ao Salvar",
                description: "Ocorreu um problema ao salvar os dados.",
            });
        } finally {
            setLoading(false);
        }
    };
    
    const modalKey = `establishment-form-${companyId}`;

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-2xl" key={modalKey}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Ficha do Estabelecimento (eSocial)</AlertDialogTitle>
                    <AlertDialogDescription>
                        Preencha os dados complementares do estabelecimento principal para o envio do evento S-1005.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                        
                        <h4 className="text-sm font-semibold text-primary">Informações Gerais</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="aliqRat" render={({ field }) => (<FormItem><FormLabel>Alíquota RAT (%)</FormLabel><FormControl><Input type="number" step="1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="fap" render={({ field }) => (<FormItem><FormLabel>FAP</FormLabel><FormControl><Input type="number" step="0.0001" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="nrCaepf" render={({ field }) => (<FormItem><FormLabel>Nº de Inscrição CAEPF</FormLabel><FormControl><Input {...field} placeholder="Nº do CAEPF (opcional)"/></FormControl><FormMessage /></FormItem>)} />
                        
                        <Separator className="my-4"/>
                        <h4 className="text-sm font-semibold text-primary">Informações Trabalhistas</h4>
                        <FormField control={form.control} name="nrInscApr" render={({ field }) => (<FormItem><FormLabel>Inscrição da Entidade Educativa (Jovem Aprendiz)</FormLabel><FormControl><Input {...field} placeholder="CNPJ da entidade (opcional)"/></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="contrataPCD" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Empresa obrigada a contratar PCD?</FormLabel><FormDescription>(Pessoa com Deficiência)</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        
                        <Separator className="my-4"/>
                        <h4 className="text-sm font-semibold text-primary">Contato Responsável</h4>
                        <FormField control={form.control} name="contatoNome" render={({ field }) => (<FormItem><FormLabel>Nome do Contato</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-2 gap-4">
                             <FormField control={form.control} name="contatoCpf" render={({ field }) => (<FormItem><FormLabel>CPF do Contato</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="contatoFone" render={({ field }) => (<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>

                         <Separator className="my-4"/>
                        <h4 className="text-sm font-semibold text-primary">Software House</h4>
                        <FormField control={form.control} name="softwareHouseRazaoSocial" render={({ field }) => (<FormItem><FormLabel>Razão Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="softwareHouseCnpj" render={({ field }) => (<FormItem><FormLabel>CNPJ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="softwareHouseNomeContato" render={({ field }) => (<FormItem><FormLabel>Nome do Contato</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                         <FormField control={form.control} name="softwareHouseTelefone" render={({ field }) => (<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        
                         <Separator className="my-4"/>
                        <h4 className="text-sm font-semibold text-primary">Outras Informações</h4>
                        <FormField
                            control={form.control}
                            name="situacaoPj"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Situação da Pessoa Jurídica</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a situação..." />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="0">Situação Normal</SelectItem>
                                    <SelectItem value="1">Extinção</SelectItem>
                                    <SelectItem value="2">Fusão</SelectItem>
                                    <SelectItem value="3">Cisão</SelectItem>
                                    <SelectItem value="4">Incorporação</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />

                         <AlertDialogFooter className="pt-4 sticky bottom-0 bg-background py-4 -mx-4 px-6 border-t">
                            <AlertDialogCancel type="button" onClick={onClose}>Cancelar</AlertDialogCancel>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Dados
                            </Button>
                        </AlertDialogFooter>
                    </form>
                </Form>
            </AlertDialogContent>
        </AlertDialog>
    )
}
