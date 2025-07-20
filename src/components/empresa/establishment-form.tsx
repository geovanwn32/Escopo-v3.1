
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
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import type { EstablishmentData } from "@/types/company";

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
  contrataPCD: z.boolean().default(false),
});

export function EstablishmentForm({ isOpen, onClose, userId, companyId, initialData, onSave }: EstablishmentFormProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const form = useForm<z.infer<typeof establishmentSchema>>({
        resolver: zodResolver(establishmentSchema),
        defaultValues: {
            aliqRat: 0,
            fap: 1.0,
            nrInscApr: "",
            contrataPCD: false,
        },
    });

    useEffect(() => {
        if (initialData) {
            form.reset(initialData);
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

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Ficha do Estabelecimento (eSocial)</AlertDialogTitle>
                    <AlertDialogDescription>
                        Preencha os dados complementares do estabelecimento principal para o envio do evento S-1005.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="aliqRat"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Alíquota RAT (%)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="1" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="fap"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>FAP</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.0001" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="nrInscApr"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Inscrição da Entidade Educativa (Jovem Aprendiz)</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="CNPJ da entidade (opcional)"/>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="contrataPCD"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Empresa obrigada a contratar PCD?</FormLabel>
                                        <FormDescription>
                                            (Pessoa com Deficiência)
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
                         <AlertDialogFooter className="pt-4">
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
