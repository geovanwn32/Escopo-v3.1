
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, onSnapshot, query, addDoc, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, PlusCircle, Trash2, Loader2, Save, Search, BookOpen } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import type { Partner } from '@/types/partner';
import type { Produto } from '@/types/produto';
import type { Servico } from '@/types/servico';
import Link from 'next/link';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { generateQuotePdf } from '@/services/quote-service';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Orcamento, OrcamentoItem } from '@/types/orcamento';
import { Timestamp } from 'firebase/firestore';
import { PartnerSelectionModal } from '@/components/parceiros/partner-selection-modal';
import { ItemSelectionModal, type CatalogoItem } from '@/components/produtos/item-selection-modal';


const quoteItemSchema = z.object({
  type: z.enum(['produto', 'servico']),
  id: z.string().optional(),
  description: z.string().min(1, "A descrição é obrigatória."),
  quantity: z.coerce.number().min(0.01, "Qtd. deve ser maior que 0"),
  unitPrice: z.coerce.number().min(0, "O preço deve ser positivo."),
  total: z.coerce.number(),
});

const quoteSchema = z.object({
  partnerId: z.string().min(1, "Selecione um cliente"),
  items: z.array(quoteItemSchema).min(1, "Adicione pelo menos um item ao orçamento."),
});

type FormData = z.infer<typeof quoteSchema>;
export type QuoteFormData = FormData;


function OrcamentoPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const orcamentoId = searchParams.get('id');

    const [loading, setLoading] = useState(true);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [currentOrcamentoId, setCurrentOrcamentoId] = useState<string | null>(orcamentoId);
    const [isPartnerModalOpen, setPartnerModalOpen] = useState(false);
    const [isItemModalOpen, setItemModalOpen] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

    const { user } = useAuth();
    const { toast } = useToast();

    const form = useForm<FormData>({
        resolver: zodResolver(quoteSchema),
        defaultValues: {
            partnerId: '',
            items: [],
        },
    });

    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: "items"
    });

    const watchItems = form.watch('items');
    const totalQuote = watchItems.reduce((acc, item) => acc + (item.total || 0), 0);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const companyId = sessionStorage.getItem('activeCompanyId');
            if (user && companyId) {
                const companyDataString = sessionStorage.getItem(`company_${companyId}`);
                if (companyDataString) setActiveCompany(JSON.parse(companyDataString));
            } else {
                setLoading(false);
            }
        }
    }, [user]);

    const loadOrcamento = useCallback(async (id: string, company: Company) => {
        if (!user) return;
        const orcamentoRef = doc(db, `users/${user.uid}/companies/${company.id}/orcamentos`, id);
        const orcamentoSnap = await getDoc(orcamentoRef);
        if (orcamentoSnap.exists()) {
            const data = orcamentoSnap.data() as Orcamento;
            
            const partnerRef = doc(db, `users/${user.uid}/companies/${company.id}/partners`, data.partnerId);
            const partnerSnap = await getDoc(partnerRef);
            if(partnerSnap.exists()){
                setSelectedPartner({ id: partnerSnap.id, ...partnerSnap.data() } as Partner);
            }

            form.reset({
                partnerId: data.partnerId,
                items: data.items,
            });
        }
        setLoading(false);
    }, [user, form]);
    
    useEffect(() => {
        if (orcamentoId && activeCompany) {
            loadOrcamento(orcamentoId, activeCompany);
        } else {
            setLoading(false);
        }
    }, [orcamentoId, activeCompany, loadOrcamento]);

    const handleFieldChange = (index: number, fieldName: 'quantity' | 'unitPrice', value: string) => {
        const currentItem = form.getValues(`items.${index}`);
        const numberValue = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
        const newValues = { ...currentItem, [fieldName]: numberValue };
        
        const quantity = newValues.quantity || 1;
        const unitPrice = newValues.unitPrice || 0;
        newValues.total = parseFloat((quantity * unitPrice).toFixed(2));
        
        update(index, newValues as any);
    };

    const handleDescriptionChange = (index: number, value: string) => {
        update(index, { ...form.getValues(`items.${index}`), description: value });
    }

    const handleSelectPartner = (partner: Partner) => {
        setSelectedPartner(partner);
        form.setValue('partnerId', partner.id!);
        form.clearErrors('partnerId');
        setPartnerModalOpen(false);
    };

    const addManualItem = () => {
      append({ type: 'produto', id: `manual_${Date.now()}`, description: '', quantity: 1, unitPrice: 0, total: 0 });
    };

    const handleSelectItems = (items: CatalogoItem[]) => {
        items.forEach(item => {
            append({
                type: item.type,
                id: item.id,
                description: item.description,
                quantity: 1,
                unitPrice: item.unitPrice,
                total: item.unitPrice
            });
        });
        setItemModalOpen(false);
    }
    
    const handleSaveAndGeneratePdf = async (data: FormData) => {
        if (!user || !activeCompany) {
            toast({ variant: 'destructive', title: 'Usuário ou empresa não identificada.' });
            return;
        }
        setLoading(true);
        try {
            if (!selectedPartner) {
                toast({ variant: 'destructive', title: 'Cliente não encontrado' });
                return;
            }
            
            const orcamentoData = {
                ...data,
                total: totalQuote,
                partnerName: selectedPartner.razaoSocial,
                updatedAt: serverTimestamp()
            };

            let docId = currentOrcamentoId;
            if (docId) {
                const orcamentoRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/orcamentos`, docId);
                await setDoc(orcamentoRef, { ...orcamentoData, updatedAt: serverTimestamp() }, { merge: true });
            } else {
                 const orcamentosRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/orcamentos`);
                 const docRef = await addDoc(orcamentosRef, { ...orcamentoData, createdAt: serverTimestamp() });
                 docId = docRef.id;
                 setCurrentOrcamentoId(docId);
                 router.replace(`/fiscal/orcamento?id=${docId}`, { scroll: false });
            }
            toast({ title: "Orçamento salvo com sucesso!", description: "Gerando PDF..." });
            generateQuotePdf(activeCompany, selectedPartner, data);
        } catch(error) {
             toast({ variant: 'destructive', title: 'Erro ao salvar orçamento.' });
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveAndGeneratePdf)}>
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" asChild>
                            <Link href="/fiscal">
                                <ArrowLeft className="h-4 w-4" />
                                <span className="sr-only">Voltar</span>
                            </Link>
                        </Button>
                        <h1 className="text-2xl font-bold">{orcamentoId ? 'Editar Orçamento' : 'Gerador de Orçamento'}</h1>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Detalhes do Orçamento</CardTitle>
                            <CardDescription>Selecione o cliente e adicione os itens para gerar o orçamento em PDF.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <FormField
                                control={form.control}
                                name="partnerId"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cliente</FormLabel>
                                     <div className="flex gap-2">
                                        <FormControl>
                                            <Input 
                                                readOnly
                                                value={selectedPartner?.razaoSocial || ''}
                                                placeholder="Nenhum cliente selecionado"
                                            />
                                        </FormControl>
                                        <Button type="button" variant="outline" onClick={() => setPartnerModalOpen(true)} disabled={!activeCompany}>
                                            <Search className="mr-2 h-4 w-4" /> Buscar Cliente
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />

                            <div className="space-y-4 pt-4">
                                <FormLabel>Itens do Orçamento</FormLabel>
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-12 gap-x-2 gap-y-4 items-start p-3 border rounded-md bg-muted/50">
                                        
                                        <div className="col-span-12 md:col-span-6">
                                             <FormItem><FormLabel className="text-xs">Descrição do Item</FormLabel>
                                              <Input 
                                                 value={watchItems[index]?.description || ''} 
                                                 onChange={(e) => handleDescriptionChange(index, e.target.value)}
                                              />
                                            </FormItem>
                                        </div>

                                        <div className="col-span-4 md:col-span-2">
                                            <FormItem><FormLabel className="text-xs">Qtd.</FormLabel>
                                              <Input type="number" min="1" 
                                                defaultValue={watchItems[index]?.quantity || '1'} 
                                                onBlur={(e) => handleFieldChange(index, 'quantity', e.target.value)}
                                              />
                                            </FormItem>
                                        </div>
                                        <div className="col-span-4 md:col-span-3">
                                            <FormItem><FormLabel className="text-xs">Vlr. Unitário</FormLabel>
                                              <Input type="text"
                                                defaultValue={(watchItems[index]?.unitPrice || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                                onBlur={(e) => handleFieldChange(index, 'unitPrice', e.target.value)}
                                              />
                                            </FormItem>
                                        </div>
                                        <div className="col-span-3 md:col-span-1 flex items-end h-full">
                                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" className="w-full" onClick={addManualItem}>
                                        <PlusCircle className="mr-2 h-4 w-4"/>Adicionar Item Manual
                                    </Button>
                                    <Button type="button" variant="secondary" className="w-full" onClick={() => setItemModalOpen(true)}>
                                        <BookOpen className="mr-2 h-4 w-4"/>Adicionar do Catálogo
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between items-center bg-muted p-4 rounded-b-lg">
                            <h3 className="text-lg font-bold">Total: {totalQuote.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h3>
                            <Button type="submit" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                                {orcamentoId ? 'Atualizar e Gerar PDF' : 'Salvar e Gerar PDF'}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </form>
            
            {user && activeCompany && (
                <PartnerSelectionModal
                    isOpen={isPartnerModalOpen}
                    onClose={() => setPartnerModalOpen(false)}
                    onSelect={handleSelectPartner}
                    userId={user.uid}
                    companyId={activeCompany.id}
                    partnerType='cliente'
                />
            )}
             {user && activeCompany && (
                <ItemSelectionModal
                    isOpen={isItemModalOpen}
                    onClose={() => setItemModalOpen(false)}
                    onSelect={handleSelectItems}
                    userId={user.uid}
                    companyId={activeCompany.id}
                />
            )}
        </Form>
    );
}

// Wrapper to use searchParams
export default function OrcamentoPageWrapper() {
    return <OrcamentoPage />;
}
