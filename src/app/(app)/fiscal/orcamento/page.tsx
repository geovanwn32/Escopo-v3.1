
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, onSnapshot, query, addDoc, doc, setDoc, serverTimestamp, getDoc, getCountFromServer, orderBy } from 'firebase/firestore';
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
  itemLc: z.string().optional().nullable(),
  issAliquota: z.coerce.number().optional().nullable(),
});

const quoteSchema = z.object({
  partnerId: z.string().min(1, "Selecione um cliente"),
  items: z.array(quoteItemSchema).min(1, "Adicione pelo menos um item ao orçamento."),
});

type FormData = z.infer<typeof quoteSchema>;
export type QuoteFormData = FormData;


export default function OrcamentoPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const orcamentoId = searchParams.get('id');

    const [loading, setLoading] = useState(true);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [currentOrcamento, setCurrentOrcamento] = useState<Orcamento | null>(null);
    const [isPartnerModalOpen, setPartnerModalOpen] = useState(false);
    const [isItemModalOpen, setItemModalOpen] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [partners, setPartners] = useState<Partner[]>([]);

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
    
    // Recalculate totals whenever items change
    useEffect(() => {
        watchItems.forEach((item, index) => {
            const quantity = item.quantity || 0;
            const unitPrice = item.unitPrice || 0;
            const newTotal = parseFloat((quantity * unitPrice).toFixed(2));
            if (item.total !== newTotal) {
                 form.setValue(`items.${index}.total`, newTotal, { shouldValidate: true });
            }
        });
    }, [watchItems, form]);

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

    // Fetch partners when company is active
    useEffect(() => {
        if (!user || !activeCompany) {
            setPartners([]);
            return;
        }

        const partnersRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/partners`);
        const q = query(partnersRef, orderBy('razaoSocial', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const partnersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner));
            setPartners(partnersData);
        }, (error) => {
            console.error("Error fetching partners: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar parceiros." });
        });

        return () => unsubscribe();
    }, [user, activeCompany, toast]);

    const loadOrcamento = useCallback(async (id: string, company: Company) => {
        if (!user) return;
        setLoading(true);
        try {
            const orcamentoRef = doc(db, `users/${user.uid}/companies/${company.id}/orcamentos`, id);
            const orcamentoSnap = await getDoc(orcamentoRef);
            if (orcamentoSnap.exists()) {
                const data = { id: orcamentoSnap.id, ...orcamentoSnap.data() } as Orcamento;
                setCurrentOrcamento(data);
                
                const partnerRef = doc(db, `users/${user.uid}/companies/${company.id}/partners`, data.partnerId);
                const partnerSnap = await getDoc(partnerRef);
                if(partnerSnap.exists()){
                    setSelectedPartner({ id: partnerSnap.id, ...partnerSnap.data() } as Partner);
                }

                form.reset({
                    partnerId: data.partnerId,
                    items: data.items.map(item => ({ ...item, unitPrice: Number(item.unitPrice), total: Number(item.total) })),
                });
            } else {
                 toast({ variant: 'destructive', title: 'Orçamento não encontrado.' });
                 router.push('/fiscal');
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao carregar orçamento.' });
        } finally {
            setLoading(false);
        }
    }, [user, form, router, toast]);
    
    useEffect(() => {
        if (orcamentoId && activeCompany) {
            loadOrcamento(orcamentoId, activeCompany);
        } else {
            setLoading(false);
        }
    }, [orcamentoId, activeCompany, loadOrcamento]);

    const handleSelectPartner = (partner: Partner) => {
        setSelectedPartner(partner);
        form.setValue('partnerId', partner.id!);
        form.clearErrors('partnerId');
        setPartnerModalOpen(false);
    };

    const addManualItem = (type: 'produto' | 'servico') => {
        const baseItem: OrcamentoItem = {
            type,
            id: `manual_${Date.now()}`,
            description: '',
            quantity: 1,
            unitPrice: 0,
            total: 0,
            itemLc: '',
            issAliquota: 0,
        };
      append(baseItem);
    };

    const handleSelectItems = (items: CatalogoItem[]) => {
        items.forEach(item => {
            const newItem: OrcamentoItem = {
                type: item.type,
                id: item.id,
                description: item.description,
                quantity: 1,
                unitPrice: item.unitPrice,
                total: item.unitPrice,
                itemLc: item.type === 'servico' ? (item as any).itemLc : '',
                issAliquota: item.type === 'servico' ? (item as any).issAliquota || 0 : 0,
            };
            append(newItem);
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
                setLoading(false);
                return;
            }
            
            const orcamentosRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/orcamentos`);
            let docId = currentOrcamento?.id;
            let quoteNumber = currentOrcamento?.quoteNumber;
            
            if (!docId) { 
                const snapshot = await getCountFromServer(orcamentosRef);
                quoteNumber = snapshot.data().count + 1;
            }
            
            // Clean and convert data before saving
            const cleanedItems = data.items.map(item => ({
                type: item.type,
                id: item.id || '',
                description: item.description,
                quantity: Number(String(item.quantity).replace(',', '.')) || 0,
                unitPrice: Number(String(item.unitPrice).replace(',', '.')) || 0,
                total: (Number(String(item.quantity).replace(',', '.')) || 0) * (Number(String(item.unitPrice).replace(',', '.')) || 0),
                itemLc: item.itemLc || '', // Ensure field exists
                issAliquota: item.issAliquota || 0, // Ensure field exists
            }));

            const finalTotal = cleanedItems.reduce((acc, item) => acc + item.total, 0);

            const orcamentoData: Omit<Orcamento, 'id'> = {
                quoteNumber: quoteNumber!,
                partnerId: data.partnerId,
                items: cleanedItems,
                total: finalTotal,
                partnerName: selectedPartner.razaoSocial,
                createdAt: currentOrcamento?.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            if (docId) {
                const orcamentoRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/orcamentos`, docId);
                await setDoc(orcamentoRef, { ...orcamentoData, createdAt: currentOrcamento?.createdAt }, { merge: true });
            } else {
                 const docRef = await addDoc(orcamentosRef, orcamentoData);
                 docId = docRef.id;
                 router.replace(`/fiscal/orcamento?id=${docId}`, { scroll: false });
            }
            toast({ title: "Orçamento salvo com sucesso!", description: "Gerando PDF..." });
            generateQuotePdf(activeCompany, selectedPartner, { ...orcamentoData, id: docId } as Orcamento);
        } catch(error) {
             console.error("Erro ao salvar:", error);
             toast({ variant: 'destructive', title: 'Erro ao salvar orçamento.' });
        } finally {
            setLoading(false);
        }
    }

    if (loading && orcamentoId) {
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
                             <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>Detalhes do Orçamento</CardTitle>
                                    <CardDescription>Selecione o cliente e adicione os itens para gerar o orçamento em PDF.</CardDescription>
                                </div>
                                {currentOrcamento && (
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-muted-foreground">Nº DO ORÇAMENTO</p>
                                        <p className="text-xl font-bold">{String(currentOrcamento.quoteNumber).padStart(4, '0')}</p>
                                    </div>
                                )}
                            </div>
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
                                    <div key={field.id} className="p-3 border rounded-md bg-muted/50">
                                       {field.type === 'produto' ? (
                                            <div className="grid grid-cols-12 gap-x-2 gap-y-4 items-end">
                                                <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (<FormItem className="col-span-12 md:col-span-5"><FormLabel className="text-xs">Descrição do Item</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (<FormItem className="col-span-4 md:col-span-2"><FormLabel className="text-xs">Qtd.</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field }) => (<FormItem className="col-span-4 md:col-span-2"><FormLabel className="text-xs">Vlr. Unitário</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name={`items.${index}.total`} render={({ field }) => (<FormItem className="col-span-4 md:col-span-2"><FormLabel className="text-xs">Vlr. Total</FormLabel><FormControl><Input readOnly value={(field.value || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} className="font-semibold" /></FormControl><FormMessage /></FormItem>)} />
                                                <div className="col-span-12 md:col-span-1 flex justify-end"><Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button></div>
                                            </div>
                                       ) : (
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-12 gap-x-2 gap-y-4 items-end">
                                                    <FormField control={form.control} name={`items.${index}.itemLc`} render={({ field }) => (<FormItem className="col-span-3 md:col-span-2"><FormLabel className="text-xs">Nr Item LC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (<FormItem className="col-span-9 md:col-span-9"><FormLabel className="text-xs">Descrição do Serviço</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                    <div className="col-span-12 md:col-span-1 flex justify-end"><Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button></div>
                                                </div>
                                                <div className="grid grid-cols-12 gap-x-2 gap-y-4 items-end">
                                                    <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel className="text-xs">Qtd.</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel className="text-xs">Vlr. Unitário</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={form.control} name={`items.${index}.issAliquota`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel className="text-xs">Alíquota ISS (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={form.control} name={`items.${index}.total`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel className="text-xs">Vlr. Total</FormLabel><FormControl><Input readOnly value={(field.value || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} className="font-semibold" /></FormControl><FormMessage /></FormItem>)} />
                                                </div>
                                            </div>
                                       )}
                                    </div>
                                ))}
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" className="w-full" onClick={() => addManualItem('produto')}>
                                        <PlusCircle className="mr-2 h-4 w-4"/>Adicionar Produto Manual
                                    </Button>
                                     <Button type="button" variant="outline" className="w-full" onClick={() => addManualItem('servico')}>
                                        <PlusCircle className="mr-2 h-4 w-4"/>Adicionar Serviço Manual
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
                    partners={partners}
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
