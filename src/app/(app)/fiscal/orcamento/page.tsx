
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, onSnapshot, query, where, orderBy, addDoc, doc, setDoc, serverTimestamp, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, PlusCircle, Trash2, Loader2, Save, Search } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/company';
import type { Partner } from '@/types/partner';
import type { Produto } from '@/types/produto';
import type { Servico } from '@/types/servico';
import Link from 'next/link';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { generateQuotePdf } from '@/services/quote-service';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Orcamento, OrcamentoItem } from '@/types/orcamento';
import { Timestamp } from 'firebase/firestore';
import { PartnerSelectionModal } from '@/components/parceiros/partner-selection-modal';

const quoteItemSchema = z.object({
  type: z.enum(['produto', 'servico']),
  id: z.string().min(1, "Selecione um item"),
  description: z.string(),
  quantity: z.coerce.number().min(1, "Quantidade deve ser pelo menos 1"),
  unitPrice: z.coerce.number(),
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

    const [products, setProducts] = useState<Produto[]>([]);
    const [services, setServices] = useState<Servico[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [currentOrcamentoId, setCurrentOrcamentoId] = useState<string | null>(orcamentoId);
    const [isPartnerModalOpen, setPartnerModalOpen] = useState(false);
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
    const totalQuote = watchItems.reduce((acc, item) => acc + item.total, 0);

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

    useEffect(() => {
        if (!user || !activeCompany) {
            setLoading(false);
            setProducts([]); setServices([]);
            return;
        }

        let isMounted = true;
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const productsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/produtos`);
                const servicesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/servicos`);

                const [prodSnap, servSnap] = await Promise.all([
                    getDocs(query(productsRef)),
                    getDocs(query(servicesRef))
                ]);
                
                if (!isMounted) return;

                const productsData = prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Produto));
                productsData.sort((a, b) => a.descricao.localeCompare(b.descricao));
                setProducts(productsData);

                const servicesData = servSnap.docs.map(d => ({ id: d.id, ...d.data() } as Servico));
                servicesData.sort((a, b) => a.descricao.localeCompare(b.descricao));
                setServices(servicesData);


                if (orcamentoId) {
                    const orcamentoRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/orcamentos`, orcamentoId);
                    const orcamentoSnap = await getDoc(orcamentoRef);
                    if (orcamentoSnap.exists()) {
                        const data = orcamentoSnap.data() as Orcamento;
                        
                        const partnerRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/partners`, data.partnerId);
                        const partnerSnap = await getDoc(partnerRef);
                        if(partnerSnap.exists()){
                            setSelectedPartner({ id: partnerSnap.id, ...partnerSnap.data() } as Partner);
                        }

                        form.reset({
                            partnerId: data.partnerId,
                            items: data.items,
                        });
                    }
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro ao carregar dados' });
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        
        loadInitialData();
        return () => { isMounted = false; };

    }, [user, activeCompany, orcamentoId, form, toast]);


    const handleItemChange = (index: number, itemId: string, type: 'produto' | 'servico') => {
        const selectedItem = type === 'produto' 
            ? products.find(p => p.id === itemId)
            : services.find(s => s.id === itemId);

        if (selectedItem) {
            const unitPrice = type === 'produto' ? (selectedItem as Produto).valorUnitario : (selectedItem as Servico).valorPadrao;
            const quantity = form.getValues(`items.${index}.quantity`) || 1;
            update(index, {
                ...watchItems[index],
                id: itemId,
                description: selectedItem.descricao,
                unitPrice,
                total: quantity * unitPrice
            });
        }
    };
    
    const handleQuantityChange = (index: number, quantity: number) => {
        const item = form.getValues(`items.${index}`);
        update(index, { ...item, quantity, total: quantity * (item.unitPrice || 0) });
    };

    const handleSelectPartner = (partner: Partner) => {
        setSelectedPartner(partner);
        form.setValue('partnerId', partner.id!);
        form.clearErrors('partnerId'); // Clear error after selection
        setPartnerModalOpen(false);
    };
    
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
                                    <div key={field.id} className="flex gap-2 items-end p-3 border rounded-md">
                                        <div className="w-2/12">
                                            <FormField control={form.control} name={`items.${index}.type`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Tipo</FormLabel><Select onValueChange={(value) => { field.onChange(value); update(index, { ...watchItems[index], type: value as any, id: '', description: '', unitPrice: 0, total: 0 }); }} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="produto">Produto</SelectItem><SelectItem value="servico">Serviço</SelectItem></SelectContent></Select></FormItem> )}/>
                                        </div>
                                         <div className="w-5/12">
                                            <FormField control={form.control} name={`items.${index}.id`} render={({ field: { onChange, ...restField } }) => ( <FormItem><FormLabel className="text-xs">Item</FormLabel><Select onValueChange={(value) => { onChange(value); handleItemChange(index, value, watchItems[index].type); }} {...restField}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent>
                                            {watchItems[index].type === 'produto' 
                                                ? products.map(p => <SelectItem key={p.id} value={p.id!}>{p.descricao}</SelectItem>)
                                                : services.map(s => <SelectItem key={s.id} value={s.id!}>{s.descricao}</SelectItem>)
                                            }
                                            </SelectContent></Select></FormItem> )}/>
                                        </div>
                                        <div className="w-2/12">
                                            <FormField control={form.control} name={`items.${index}.quantity`} render={({ field: { onChange, ...restField } }) => ( <FormItem><FormLabel className="text-xs">Qtd.</FormLabel><FormControl><Input type="number" min="1" onChange={(e) => { onChange(e); handleQuantityChange(index, Number(e.target.value)); }} {...restField} /></FormControl></FormItem> )}/>
                                        </div>
                                         <div className="w-2/12">
                                            <FormItem><FormLabel className="text-xs">Vlr. Total</FormLabel><Input value={(watchItems[index].total || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} readOnly /></FormItem>
                                        </div>
                                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" className="w-full" onClick={() => append({ type: 'produto', id: '', description: '', quantity: 1, unitPrice: 0, total: 0 })}>
                                    <PlusCircle className="mr-2 h-4 w-4"/>Adicionar Item
                                </Button>
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
        </Form>
    );
}

// Wrapper to use searchParams
export default function OrcamentoPageWrapper() {
    return <OrcamentoPage />;
}
