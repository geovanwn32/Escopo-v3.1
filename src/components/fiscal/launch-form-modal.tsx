
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, PlusCircle, Trash2, FileText, Save } from 'lucide-react';
import { Launch, Company } from '@/types';
import { isValid } from 'date-fns';
import { Textarea } from '../ui/textarea';
import { Badge } from '@/components/ui/badge';
import { upsertProductsFromLaunch } from '@/services/product-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PartnerSelectionModal } from '../parceiros/partner-selection-modal';
import type { Partner } from '@/types/partner';
import { upsertPartnerFromLaunch } from '@/services/partner-service';
import type { Orcamento } from '@/types/orcamento';
import type { Produto } from '@/types/produto';
import type { Servico } from '@/types/servico';
import { Separator } from '../ui/separator';
import { DateInput } from '../ui/date-input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';


interface XmlFile {
  file: { name: string; type: string; size: number; lastModified: number; };
  content: string;
  status: 'pending' | 'launched' | 'error' | 'cancelled';
  type: 'entrada' | 'saida' | 'servico' | 'desconhecido' | 'cancelamento';
  key?: string;
  versaoNfse?: string;
}

export interface OpenModalOptions {
  xmlFile?: XmlFile | null;
  launch?: Launch | null;
  orcamento?: Orcamento | null;
  manualLaunchType?: 'entrada' | 'saida' | 'servico' | null;
  mode?: 'create' | 'edit' | 'view';
}

interface LaunchFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: OpenModalOptions;
  userId: string;
  company: Company;
  onLaunchSuccess: (launchedKey: string, status: Launch['status']) => void;
  partners: Partner[];
  products: Produto[];
  services: Servico[];
}

const partySchema = z.object({
  nome: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
}).optional().nullable();

const productSchema = z.object({
    codigo: z.string().optional().nullable(),
    descricao: z.string().min(1, "Descrição é obrigatória"),
    ncm: z.string().optional().nullable(),
    cfop: z.string().optional().nullable(),
    unidade: z.string().optional().nullable(),
    quantidade: z.coerce.number().default(1),
    valorUnitario: z.coerce.number().default(0),
    valorTotal: z.coerce.number().default(0),
    baseCalculo: z.coerce.number().optional().nullable(),
    vlrIcms: z.coerce.number().optional().nullable(),
    vlrIpi: z.coerce.number().optional().nullable(),
    aliqIcms: z.coerce.number().optional().nullable(),
    aliqIpi: z.coerce.number().optional().nullable(),
});

const launchSchema = z.object({
  fileName: z.string().default(''),
  type: z.string().min(1, "O tipo de lançamento é obrigatório"),
  status: z.enum(['Normal', 'Cancelado', 'Substituida']),
  date: z.date({ required_error: "A data é obrigatória." }),
  observacoes: z.string().optional().nullable(),

  chaveNfe: z.string().optional().nullable(),
  numeroNfse: z.string().optional().nullable(),
  serie: z.string().optional().nullable(),

  emitente: partySchema,
  destinatario: partySchema,

  produtos: z.array(productSchema).optional(),

  valorProdutos: z.coerce.number().optional().nullable(),
  valorTotalNota: z.coerce.number().optional().nullable(),
  valorIpi: z.coerce.number().optional().nullable(),
  valorIcms: z.coerce.number().optional().nullable(),
  valorPis: z.coerce.number().optional().nullable(),
  valorCofins: z.coerce.number().optional().nullable(),

  modalidadeFrete: z.string().optional().nullable(),
});


type FormData = z.infer<typeof launchSchema>;

const querySelectorText = (element: Element | Document | null, selectors: string[]): string => {
  if (!element) return '';
  for (const selector of selectors) {
    const el = element.querySelector(selector);
    if (el?.textContent) {
      return el.textContent.trim();
    }
  }
  return '';
};

const getFloat = (node: Element | null, selector: string) => parseFloat(node?.querySelector(selector)?.textContent || '0');

function parseXmlAdvanced(xmlString: string, type: 'entrada' | 'saida' | 'servico' | 'desconhecido'): Partial<FormData> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
        console.error("Error parsing XML:", errorNode.textContent);
        return {};
    }

    const data: Partial<FormData> = {};
    const infNFe = xmlDoc.querySelector('infNFe');

    if (infNFe) { // It's an NF-e (product note)
        const ide = infNFe.querySelector('ide');
        const emit = infNFe.querySelector('emit');
        const dest = infNFe.querySelector('dest');
        const total = infNFe.querySelector('ICMSTot');
        const transp = infNFe.querySelector('transp');

        const dateString = querySelectorText(ide, ['dhEmi', 'dEmi']);
        if (dateString) {
            const tempDate = new Date(dateString.split('T')[0]);
            const timezoneOffset = tempDate.getTimezoneOffset() * 60000;
            data.date = new Date(tempDate.getTime() + timezoneOffset);
        } else {
            data.date = new Date();
        }

        data.chaveNfe = infNFe.getAttribute('Id')?.replace('NFe', '') || '';
        data.numeroNfse = querySelectorText(ide, ['nNF']);
        data.serie = querySelectorText(ide, ['serie']);
        
        data.emitente = {
            nome: querySelectorText(emit, ['xNome']),
            cnpj: querySelectorText(emit, ['CNPJ', 'CPF']),
        };
        data.destinatario = {
            nome: querySelectorText(dest, ['xNome']),
            cnpj: querySelectorText(dest, ['CNPJ', 'CPF']),
        };

        data.valorTotalNota = getFloat(total, 'vNF');
        data.valorProdutos = getFloat(total, 'vProd');
        data.valorPis = getFloat(total, 'vPIS');
        data.valorCofins = getFloat(total, 'vCOFINS');
        data.valorIcms = getFloat(total, 'vICMS');
        data.valorIpi = getFloat(total, 'vIPI');
        data.modalidadeFrete = querySelectorText(transp, ['modFrete']);
        
        data.produtos = Array.from(infNFe.querySelectorAll('det')).map(det => {
            const prod = det.querySelector('prod');
            const imposto = det.querySelector('imposto');
            
            return {
                codigo: querySelectorText(prod, ['cProd']),
                descricao: querySelectorText(prod, ['xProd']) || '',
                ncm: querySelectorText(prod, ['NCM']),
                cfop: querySelectorText(prod, ['CFOP']),
                unidade: querySelectorText(prod, ['uCom']),
                quantidade: getFloat(prod, 'qCom'),
                valorUnitario: getFloat(prod, 'vUnCom'),
                valorTotal: getFloat(prod, 'vProd'),
                baseCalculo: getFloat(imposto, 'vBC'),
                vlrIcms: getFloat(imposto, 'vICMS'),
                vlrIpi: getFloat(imposto, 'vIPI'),
                aliqIcms: getFloat(imposto, 'pICMS'),
                aliqIpi: getFloat(imposto, 'pIPI'),
            };
        });

    } 
    // This part is simplified now as we focus on NF-e, but kept for structure
    else if (type === 'servico') {
        data.date = new Date();
        data.valorTotalNota = getFloat(xmlDoc, ['ValoresNfse > ValorLiquidoNfse', 'ValorLiquidoNfse']);
    }
    
    return data;
}

const defaultLaunchValues: Partial<FormData> = {
    fileName: '',
    status: 'Normal',
    date: new Date(),
    produtos: [],
    modalidadeFrete: '9', // Default to "Sem Frete"
    chaveNfe: '',
    numeroNfse: '',
    serie: '',
    observacoes: '',
    emitente: { nome: '', cnpj: '' },
    destinatario: { nome: '', cnpj: '' },
    valorProdutos: 0,
    valorTotalNota: 0,
    valorIcms: 0,
    valorIpi: 0,
    valorPis: 0,
    valorCofins: 0,
};

const getInitialData = (
    options: OpenModalOptions,
    company: Company,
): Partial<FormData> => {
    const { mode = 'create', xmlFile, launch, manualLaunchType } = options;
    if (mode === 'create') {
        if (xmlFile) {
            const parsedData = parseXmlAdvanced(xmlFile.content, xmlFile.type as any);
            return {
                ...defaultLaunchValues,
                ...parsedData,
                type: xmlFile.type,
                fileName: xmlFile.file.name,
                status: xmlFile.status === 'cancelled' ? 'Cancelado' : 'Normal',
            };
        }
        if (manualLaunchType) {
            const manualData: Partial<FormData> = { 
                ...defaultLaunchValues,
                type: manualLaunchType, 
                date: new Date(), 
                fileName: 'Lançamento Manual', 
                status: 'Normal',
                produtos: [],
                modalidadeFrete: '9'
            };
            if(manualLaunchType === 'saida') manualData.emitente = { nome: company.razaoSocial, cnpj: company.cnpj };
            if(manualLaunchType === 'entrada') manualData.destinatario = { nome: company.razaoSocial, cnpj: company.cnpj };
            return manualData;
        }
    } else if ((mode === 'edit' || mode === 'view') && launch) {
        return { ...defaultLaunchValues, ...launch };
    }
    return defaultLaunchValues;
};


export const LaunchFormModal = ({
    isOpen,
    onClose,
    initialData,
    userId,
    company,
    onLaunchSuccess,
    partners,
}: LaunchFormModalProps) => {
    const [isPartnerModalOpen, setPartnerModalOpen] = useState(false);
    const [partnerTarget, setPartnerTarget] = useState<'emitente' | 'destinatario' | null>(null);
    const [loading, setLoading] = useState(false);

    const { toast } = useToast();

    const form = useForm<FormData>({ 
        resolver: zodResolver(launchSchema),
        defaultValues: defaultLaunchValues,
    });
    const { control, setValue, reset, getValues } = form;

    const { fields, append, remove } = useFieldArray({
        control,
        name: "produtos",
    });

    const watchedProducts = useWatch({ control, name: 'produtos' });
    
    useEffect(() => {
        if (watchedProducts) {
             const newTotal = watchedProducts.reduce((acc, p) => acc + (p.valorTotal || 0), 0);
             if (newTotal !== getValues('valorTotalNota')) {
                setValue('valorTotalNota', parseFloat(newTotal.toFixed(2)));
             }
        }
    }, [watchedProducts, setValue, getValues]);


    useEffect(() => {
        if (isOpen && initialData) {
            const data = getInitialData(initialData, company);
            reset(data);
        }
    }, [isOpen, initialData, company, reset]);
  
    const { mode = 'create' } = initialData;
    const isReadOnly = mode === 'view';

    const handleSelectPartner = (partner: Partner) => {
        if (!partnerTarget) return;
        form.setValue(`${partnerTarget}.nome`, partner.razaoSocial);
        form.setValue(`${partnerTarget}.cnpj`, partner.cpfCnpj);
        setPartnerModalOpen(false);
        setPartnerTarget(null);
    };

    const openPartnerSearch = (target: 'emitente' | 'destinatario') => {
      setPartnerTarget(target);
      setPartnerModalOpen(true);
    };

    const handleSubmit = async (values: FormData) => {
        if (mode === 'view') { onClose(); return; }
        setLoading(true);
        try {
            const dataToSave: any = { ...values,
                emitente: values.emitente ? { nome: values.emitente.nome || null, cnpj: values.emitente.cnpj?.replace(/\D/g, '') || null } : null,
                destinatario: values.destinatario ? { nome: values.destinatario.nome || null, cnpj: values.destinatario.cnpj?.replace(/\D/g, '') || null } : null,
                updatedAt: serverTimestamp(),
            };
            
            if (mode === 'create') {
                dataToSave.createdAt = serverTimestamp();
            }

            const partnerType = values.type === 'entrada' ? 'fornecedor' : 'cliente';
            const partnerData = values.type === 'entrada' ? dataToSave.emitente : dataToSave.destinatario;
            if (partnerData?.cnpj && partnerData?.nome) await upsertPartnerFromLaunch(userId, company.id, { cpfCnpj: partnerData.cnpj, razaoSocial: partnerData.nome, type: partnerType });
            
            if (values.type === 'entrada' && values.produtos && values.produtos.length > 0) {
              await upsertProductsFromLaunch(userId, company.id, values.produtos as Produto[]);
            }

            const launchRef = mode === 'create' ? collection(db, `users/${userId}/companies/${company.id}/launches`) : doc(db, `users/${userId}/companies/${company.id}/launches`, initialData.launch!.id);
            if (mode === 'create') {
                await addDoc(launchRef, dataToSave);
                onLaunchSuccess(dataToSave.chaveNfe || `${dataToSave.numeroNfse}`, dataToSave.status);
            } else {
                await updateDoc(launchRef as any, dataToSave);
            }
            onClose();
        } catch (error) { 
            console.error(error); 
            toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Ocorreu um erro ao salvar o lançamento.'});
        } finally {
            setLoading(false);
        }
    };
  
    const getTitle = () => {
        const { xmlFile } = initialData;
        if (mode === 'create') return xmlFile ? 'Confirmar Lançamento de XML' : `Novo Lançamento Manual`;
        return mode === 'edit' ? 'Alterar Lançamento Fiscal' : 'Visualizar Lançamento Fiscal';
    };
    
     const renderPartyField = (partyName: 'emitente' | 'destinatario', label: string) => (
        <div className="space-y-4 rounded-md border p-4">
             <h4 className="font-semibold">{label}</h4>
            <FormField control={control} name={`${partyName}.nome`} render={({ field }) => ( <FormItem><FormLabel>Razão Social</FormLabel><div className="flex gap-2"><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl><Button type="button" variant="outline" size="icon" onClick={() => openPartnerSearch(partyName)} disabled={isReadOnly}><Search className="h-4 w-4"/></Button></div><FormMessage /></FormItem> )} />
            <FormField control={control} name={`${partyName}.cnpj`} render={({ field }) => ( <FormItem><FormLabel>CNPJ / CPF</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl><FormMessage /></FormItem> )} />
        </div>
    );

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent>
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
                    <DialogHeader>
                    <DialogTitle>{getTitle()}</DialogTitle>
                    <DialogDescription asChild>
                        <div>
                        <div className="flex items-center gap-2"><span>Tipo:</span><Badge variant="secondary" className="text-base capitalize">{form.getValues('type')}</Badge></div>
                        {(initialData.xmlFile || initialData.launch?.fileName) && <p className="flex items-center gap-1.5 text-sm mt-1 text-muted-foreground"><FileText className="h-3.5 w-3.5" /><span>{form.getValues('fileName')}</span></p>}
                        </div>
                    </DialogDescription>
                    </DialogHeader>
                     <Tabs defaultValue="geral" className="w-full pt-4 flex-grow flex flex-col">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="geral">Geral</TabsTrigger>
                            <TabsTrigger value="parties">Emitente/Destinatário</TabsTrigger>
                            <TabsTrigger value="produtos">Produtos</TabsTrigger>
                            <TabsTrigger value="transporte">Transporte/Outros</TabsTrigger>
                        </TabsList>
                        <div className="py-4 flex-grow overflow-y-auto pr-4 mt-2">
                             <TabsContent value="geral" className="space-y-4">
                                <FormField control={control} name="chaveNfe" render={({ field }) => ( <FormItem><FormLabel>Chave de Acesso</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                <div className="grid grid-cols-3 gap-4">
                                    <FormField control={control} name="numeroNfse" render={({ field }) => ( <FormItem><FormLabel>Número da Nota</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    <FormField control={control} name="serie" render={({ field }) => ( <FormItem><FormLabel>Série</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    <FormField control={control} name="date" render={({ field }) => (<FormItem><FormLabel>Data de Emissão</FormLabel><FormControl><DateInput value={field.value} onChange={field.onChange} readOnly={isReadOnly} /></FormControl></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                     <FormField control={control} name="status" render={({ field }) => (<FormItem><FormLabel>Status da Nota</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem><SelectItem value="Substituida">Substituída</SelectItem></SelectContent></Select></FormItem>)} />
                                </div>
                                <Separator className="my-4"/>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <FormField control={control} name="valorProdutos" render={({ field }) => ( <FormItem><FormLabel>Valor Total dos Produtos</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly /></FormControl></FormItem> )} />
                                    <FormField control={control} name="valorIcms" render={({ field }) => ( <FormItem><FormLabel>Valor do ICMS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    <FormField control={control} name="valorIpi" render={({ field }) => ( <FormItem><FormLabel>Valor do IPI</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    <FormField control={control} name="valorTotalNota" render={({ field }) => ( <FormItem><FormLabel>Valor Total da Nota</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly className="font-semibold border-primary" /></FormControl></FormItem> )} />
                                </div>
                            </TabsContent>
                            <TabsContent value="parties" className="space-y-4">
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {renderPartyField('emitente', 'Emitente')}
                                    {renderPartyField('destinatario', 'Destinatário')}
                                </div>
                            </TabsContent>
                            <TabsContent value="produtos" className="space-y-4">
                                <div className="space-y-2">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="p-3 border rounded-md space-y-2 relative">
                                        <div className="grid grid-cols-12 gap-x-2 gap-y-3">
                                            <FormField control={control} name={`produtos.${index}.codigo`} render={({ field }) => ( <FormItem className="col-span-2"><FormLabel className="text-xs">Código</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name={`produtos.${index}.descricao`} render={({ field }) => ( <FormItem className="col-span-10"><FormLabel className="text-xs">Descrição do Produto</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name={`produtos.${index}.ncm`} render={({ field }) => ( <FormItem className="col-span-2"><FormLabel className="text-xs">NCM</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name={`produtos.${index}.cfop`} render={({ field }) => ( <FormItem className="col-span-2"><FormLabel className="text-xs">CFOP</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name={`produtos.${index}.unidade`} render={({ field }) => ( <FormItem className="col-span-1"><FormLabel className="text-xs">Unid.</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name={`produtos.${index}.quantidade`} render={({ field }) => ( <FormItem className="col-span-2"><FormLabel className="text-xs">Qtd.</FormLabel><FormControl><Input type="number" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name={`produtos.${index}.valorUnitario`} render={({ field }) => ( <FormItem className="col-span-3"><FormLabel className="text-xs">Vlr. Unitário</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name={`produtos.${index}.valorTotal`} render={({ field }) => ( <FormItem className="col-span-2"><FormLabel className="text-xs">Vlr. Total</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly className="font-semibold" /></FormControl></FormItem> )} />
                                            
                                            <Separator className="col-span-12 my-1" />

                                            <FormField control={control} name={`produtos.${index}.baseCalculo`} render={({ field }) => ( <FormItem className="col-span-2"><FormLabel className="text-xs">BC ICMS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name={`produtos.${index}.aliqIcms`} render={({ field }) => ( <FormItem className="col-span-2"><FormLabel className="text-xs">Alíq. ICMS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name={`produtos.${index}.vlrIcms`} render={({ field }) => ( <FormItem className="col-span-2"><FormLabel className="text-xs">Valor ICMS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name={`produtos.${index}.aliqIpi`} render={({ field }) => ( <FormItem className="col-span-2"><FormLabel className="text-xs">Alíq. IPI</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name={`produtos.${index}.vlrIpi`} render={({ field }) => ( <FormItem className="col-span-2"><FormLabel className="text-xs">Valor IPI</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            {!isReadOnly && <div className="col-span-2 flex items-end"><Button type="button" size="sm" variant="destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4 mr-1"/> Remover</Button></div>}
                                        </div>
                                    </div>
                                ))}
                                </div>
                                {!isReadOnly && <Button type="button" variant="outline" className="w-full mt-2" onClick={() => append({} as any)}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Produto</Button>}
                            </TabsContent>
                            <TabsContent value="transporte" className="space-y-4">
                                <FormField control={control} name="modalidadeFrete" render={({ field }) => (<FormItem><FormLabel>Modalidade do Frete</FormLabel><Select onValueChange={field.onChange} value={field.value || '9'} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="0">Contratação do Frete por conta do Remetente (CIF)</SelectItem><SelectItem value="1">Contratação do Frete por conta do Destinatário (FOB)</SelectItem><SelectItem value="2">Contratação do Frete por conta de Terceiros</SelectItem><SelectItem value="3">Transporte Próprio por conta do Remetente</SelectItem><SelectItem value="4">Transporte Próprio por conta do Destinatário</SelectItem><SelectItem value="9">Sem Ocorrência de Transporte</SelectItem></SelectContent></Select></FormItem>)} />
                                <FormField control={control} name="observacoes" render={({ field }) => ( <FormItem><FormLabel>Dados Adicionais / Observações</FormLabel><FormControl><Textarea {...field} readOnly={isReadOnly} rows={5} /></FormControl></FormItem> )} />
                            </TabsContent>
                        </div>
                    </Tabs>
                    <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onClose}>{mode === 'view' ? 'Fechar' : 'Cancelar'}</Button>
                    {mode !== 'view' && <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}{mode === 'create' ? 'Confirmar Lançamento' : 'Salvar Alterações'}</Button>}
                    </DialogFooter>
                    </form>
                    </Form>
                </DialogContent>
            </Dialog>
            {userId && company && (
                <PartnerSelectionModal
                    isOpen={isPartnerModalOpen}
                    onClose={() => setPartnerModalOpen(false)}
                    onSelect={handleSelectPartner}
                    partners={partners}
                    partnerType={partnerTarget === 'emitente' ? 'fornecedor' : 'cliente'}
                />
            )}
        </>
    );
};

    

