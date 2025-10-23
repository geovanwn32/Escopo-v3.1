
"use client";

import { useState, useEffect } from 'react';
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
import { format, isValid } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
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
    descricao: z.string().optional().nullable(),
    ncm: z.string().optional().nullable(),
    cfop: z.string().optional().nullable(),
    quantidade: z.coerce.number().default(1),
    valorUnitario: z.coerce.number().default(0),
    valorTotal: z.coerce.number().default(0),
});

const launchSchema = z.object({
  fileName: z.string().default(''),
  type: z.string().min(1, "O tipo de lançamento é obrigatório"),
  status: z.enum(['Normal', 'Cancelado', 'Substituida']),
  date: z.date({ required_error: "A data é obrigatória." }),
  observacoes: z.string().optional().nullable(),

  // NF-e & NFS-e fields
  chaveNfe: z.string().optional().nullable(),
  numeroNfse: z.string().optional().nullable(),
  codigoVerificacaoNfse: z.string().optional().nullable(),
  versaoNfse: z.string().optional().nullable(),
  
  // NFS-e specific
  prestador: partySchema,
  tomador: partySchema,
  discriminacao: z.string().optional().nullable(),
  itemLc116: z.string().optional().nullable(),
  valorServicos: z.coerce.number().optional().nullable(),
  valorLiquido: z.coerce.number().optional().nullable(),
  
  // NF-e specific
  emitente: partySchema,
  destinatario: partySchema,
  valorProdutos: z.coerce.number().optional().nullable(),
  valorTotalNota: z.coerce.number().optional().nullable(),
  produtos: z.array(productSchema).optional(),

  // Taxes
  valorPis: z.coerce.number().optional().nullable(),
  valorCofins: z.coerce.number().optional().nullable(),
  valorCsll: z.coerce.number().optional().nullable(),
  valorIr: z.coerce.number().optional().nullable(),
  valorInss: z.coerce.number().optional().nullable(),
  valorIcms: z.coerce.number().optional().nullable(),
  valorIpi: z.coerce.number().optional().nullable(),
  valorIss: z.coerce.number().optional().nullable(),
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

function parseXmlAdvanced(xmlString: string, type: 'entrada' | 'saida' | 'servico' | 'desconhecido'): Partial<FormData> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
        console.error("Error parsing XML:", errorNode.textContent);
        return {};
    }

    const data: Partial<FormData> = {};
    
    const isNFe = xmlDoc.querySelector('infNFe');
    const isNfse = xmlDoc.querySelector('CompNfse, NFSe, ConsultarNfseServicoPrestadoResposta');

    let dateString: string | null = null;
    let dateObj: Date | undefined = undefined;

    if (isNFe) {
        const protNode = xmlDoc.querySelector('protNFe infProt');
        const dateSelectors = protNode ? ['dhRecbto'] : ['ide dhEmi', 'dEmi'];
        dateString = querySelectorText(protNode || xmlDoc, dateSelectors);
    } else if (isNfse) {
        const serviceNode = isNfse.querySelector('InfNfse') || isNfse;
        const dateSelectors = ['DataEmissao', 'dCompet', 'dtEmissao'];
        dateString = querySelectorText(serviceNode, dateSelectors);
    }
    
    if (dateString) {
        const cleanDateString = dateString.split('T')[0];
        const tempDate = new Date(cleanDateString);
        const timezoneOffset = tempDate.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(tempDate.getTime() + timezoneOffset);
        if (isValid(adjustedDate)) {
          dateObj = adjustedDate;
        }
    }
    data.date = dateObj || new Date();

    const getTax = (selectors: string[], baseNode: Element | Document = xmlDoc) => parseFloat(querySelectorText(baseNode, selectors) || '0');

    if (type === 'servico' && isNfse) {
        const nfseNode = xmlDoc.querySelector('Nfse, NFSe');
        data.versaoNfse = nfseNode?.getAttribute('versao') || xmlDoc.querySelector('CompNfse')?.getAttribute('versao') || '2.04';

        const serviceNode = xmlDoc.querySelector('InfNfse') || xmlDoc.querySelector('InfDeclaracaoPrestacaoServico') || nfseNode;
        const declaracaoServicoNode = xmlDoc.querySelector('DeclaracaoPrestacaoServico > InfDeclaracaoPrestacaoServico') || serviceNode;

        data.numeroNfse = querySelectorText(serviceNode, ['Numero', 'nNFSe']) || '';
        data.codigoVerificacaoNfse = querySelectorText(serviceNode, ['CodigoVerificacao']) || '';
        data.valorServicos = getTax(['Valores > ValorServicos', 'ValorServicos', 'vServ', 'vlrServicos'], declaracaoServicoNode);
        data.valorLiquido = getTax(['ValoresNfse > ValorLiquidoNfse', 'ValorLiquidoNfse', 'vLiq', 'vNF'], serviceNode);
        data.discriminacao = querySelectorText(declaracaoServicoNode, ['Discriminacao', 'discriminacao', 'xDescricao', 'xDescServ', 'infCpl']) || '';
        data.itemLc116 = querySelectorText(declaracaoServicoNode, ['Servico > ItemListaServico', 'ItemListaServico', 'cServico']) || '';

        const valoresNode = declaracaoServicoNode.querySelector('Servico > Valores') || serviceNode;
        data.valorPis = getTax(['ValorPis'], valoresNode);
        data.valorCofins = getTax(['ValorCofins'], valoresNode);
        data.valorIr = getTax(['ValorIr'], valoresNode);
        data.valorInss = getTax(['ValorInss'], valoresNode);
        data.valorCsll = getTax(['ValorCsll'], valoresNode);
        
        const isIssRetido = querySelectorText(valoresNode, ['IssRetido']) === '1';
        data.valorIss = isIssRetido ? getTax(['ValorIssRetido', 'ValorIss'], valoresNode) : 0;
        
        data.prestador = { nome: querySelectorText(declaracaoServicoNode, ['PrestadorServico > RazaoSocial', 'Prestador > RazaoSocial', 'Prestador > Nome', 'prest > xNome']), cnpj: querySelectorText(declaracaoServicoNode, ['PrestadorServico > CpfCnpj > Cnpj', 'Prestador > CpfCnpj > Cnpj', 'prest > CNPJ']) };
        data.tomador = { nome: querySelectorText(declaracaoServicoNode, ['TomadorServico > RazaoSocial', 'Tomador > RazaoSocial', 'toma > xNome']), cnpj: querySelectorText(declaracaoServicoNode, ['TomadorServico > IdentificacaoTomador > CpfCnpj > Cnpj', 'TomadorServico > IdentificacaoTomador > CpfCnpj > Cpf', 'Tomador > CpfCnpj > Cnpj', 'Tomador > CpfCnpj > Cpf']) };
    } else if (isNFe) {
        data.emitente = { nome: querySelectorText(xmlDoc.querySelector('emit'), ['xNome']) || '', cnpj: querySelectorText(xmlDoc.querySelector('emit'), ['CNPJ', 'CPF']) || '' };
        data.destinatario = { nome: querySelectorText(xmlDoc.querySelector('dest'), ['xNome']) || '', cnpj: querySelectorText(xmlDoc.querySelector('dest'), ['CNPJ', 'CPF']) || '' };
        data.chaveNfe = (xmlDoc.querySelector('infNFe')?.getAttribute('Id') || '').replace(/\D/g, '') || querySelectorText(xmlDoc, ['chNFe']).replace(/\D/g, '');
        data.valorProdutos = getTax(['total ICMSTot vProd']);
        data.valorTotalNota = getTax(['total ICMSTot vNF']);
        data.valorIcms = getTax(['total ICMSTot vICMS']);
        data.valorIpi = getTax(['total ICMSTot vIPI']);
        data.valorPis = getTax(['total ICMSTot vPIS']);
        data.valorCofins = getTax(['total ICMSTot vCOFINS']);
        data.produtos = Array.from(xmlDoc.querySelectorAll('det')).map(det => ({
            codigo: querySelectorText(det.querySelector('prod'), ['cProd']) || '',
            descricao: querySelectorText(det.querySelector('prod'), ['xProd']) || '',
            ncm: querySelectorText(det.querySelector('prod'), ['NCM']) || '',
            cfop: querySelectorText(det.querySelector('prod'), ['CFOP']) || '',
            quantidade: parseFloat(querySelectorText(det.querySelector('prod'), ['qCom']) || '1'),
            valorUnitario: parseFloat(querySelectorText(det.querySelector('prod'), ['vUnCom']) || '0'),
            valorTotal: parseFloat(querySelectorText(det.querySelector('prod'), ['vProd']) || '0'),
        })).filter(p => p.codigo);
    }
    
    return data;
}

const defaultLaunchValues: FormData = {
    fileName: '', type: '', status: 'Normal', date: new Date(), chaveNfe: '', numeroNfse: '',
    codigoVerificacaoNfse: '', versaoNfse: '',
    prestador: { nome: '', cnpj: '' }, tomador: { nome: '', cnpj: '' },
    discriminacao: '', itemLc116: '', valorServicos: 0, valorLiquido: 0,
    emitente: { nome: '', cnpj: '' }, destinatario: { nome: '', cnpj: '' },
    valorProdutos: 0, valorTotalNota: 0, produtos: [], observacoes: '',
    valorPis: 0, valorCofins: 0, valorCsll: 0, valorIr: 0, valorInss: 0, valorIcms: 0, valorIpi: 0, valorIss: 0,
};

const getInitialData = (
    options: OpenModalOptions,
    company: Company,
): Partial<FormData> => {
    const { mode = 'create', xmlFile, launch, orcamento, manualLaunchType } = options;
    if (mode === 'create') {
        if (xmlFile) {
            const parsedData = parseXmlAdvanced(xmlFile.content, xmlFile.type as any);
            return {
                ...parsedData,
                type: xmlFile.type,
                fileName: xmlFile.file.name,
                status: xmlFile.status === 'cancelled' ? 'Cancelado' : 'Normal',
            };
        }
        if (manualLaunchType) {
            const manualData: Partial<FormData> = { type: manualLaunchType, date: new Date(), fileName: 'Lançamento Manual', status: 'Normal' };
            if (manualLaunchType === 'servico') manualData.prestador = { nome: company.razaoSocial, cnpj: company.cnpj };
            else if (manualLaunchType === 'saida') manualData.emitente = { nome: company.razaoSocial, cnpj: company.cnpj };
            else if (manualLaunchType === 'entrada') manualData.destinatario = { nome: company.razaoSocial, cnpj: company.cnpj };
            return manualData;
        }
        if (orcamento) {
            const hasServices = orcamento.items.some(i => i.type === 'servico');
            const type = hasServices ? 'servico' : 'saida';
            const orcamentoData: Partial<FormData> = {
                type,
                date: new Date(),
                fileName: `Orçamento ${String(orcamento.quoteNumber).padStart(4, '0')}`,
                status: 'Normal',
                discriminacao: orcamento.items.map(i => `${i.quantity}x ${i.description}`).join('; '),
                valorServicos: orcamento.total,
                valorTotalNota: orcamento.total,
                valorLiquido: orcamento.total,
                produtos: orcamento.items.filter(i => i.type === 'produto').map(p => ({ codigo: p.id, descricao: p.description, valorUnitario: p.unitPrice, ncm: '', cfop: '', quantidade: p.quantity, valorTotal: p.total }))
            };
            if (type === 'servico') orcamentoData.prestador = { nome: company.razaoSocial, cnpj: company.cnpj };
            else orcamentoData.emitente = { nome: company.razaoSocial, cnpj: company.cnpj };
            return orcamentoData;
        }
    } else if ((mode === 'edit' || mode === 'view') && launch) {
        return { ...launch };
    }
    return {};
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
    const [partnerTarget, setPartnerTarget] = useState<'emitente' | 'destinatario' | 'prestador' | 'tomador' | null>(null);
    const [loading, setLoading] = useState(false);

    const { toast } = useToast();

    const form = useForm<FormData>({ 
        resolver: zodResolver(launchSchema),
    });
    const { control, setValue, getValues, reset } = form;

    const { fields, append, remove } = useFieldArray({
        control,
        name: "produtos",
    });

    // Initialize form when modal opens
    useEffect(() => {
        if (isOpen) {
            const data = getInitialData(initialData, company);
            reset({ ...defaultLaunchValues, ...data });
        }
    }, [isOpen, initialData, company, reset]);
  
    const watchedFormValues = useWatch({ control });

    useEffect(() => {
        if (watchedFormValues.type !== 'servico' && watchedFormValues.produtos) {
            const newTotalProdutos = watchedFormValues.produtos.reduce((acc, p) => acc + (p.valorTotal || 0), 0);
            setValue('valorProdutos', parseFloat(newTotalProdutos.toFixed(2)));
            setValue('valorTotalNota', parseFloat(newTotalProdutos.toFixed(2)));
        }
    }, [watchedFormValues.produtos, watchedFormValues.type, setValue]);

    useEffect(() => {
        if(watchedFormValues.type === 'servico') {
            const valorServicos = watchedFormValues.valorServicos || 0;
            const totalDeducoes = (
                (watchedFormValues.valorPis || 0) +
                (watchedFormValues.valorCofins || 0) +
                (watchedFormValues.valorCsll || 0) +
                (watchedFormValues.valorIr || 0) +
                (watchedFormValues.valorInss || 0) +
                (watchedFormValues.valorIss || 0)
            );
            const valorLiquido = valorServicos - totalDeducoes;
            setValue('valorLiquido', parseFloat(valorLiquido.toFixed(2)));
        }
    }, [
        watchedFormValues.type,
        watchedFormValues.valorServicos,
        watchedFormValues.valorPis,
        watchedFormValues.valorCofins,
        watchedFormValues.valorCsll,
        watchedFormValues.valorIr,
        watchedFormValues.valorInss,
        watchedFormValues.valorIss,
        setValue
    ]);

    const updateProductTotal = (index: number) => {
        const product = getValues(`produtos.${index}`);
        const total = (product.quantidade || 0) * (product.valorUnitario || 0);
        setValue(`produtos.${index}.valorTotal`, parseFloat(total.toFixed(2)));
    };
    
    const { launch, mode = 'create' } = initialData;
    const isReadOnly = mode === 'view';

    const handleSelectPartner = (partner: Partner) => {
        if (!partnerTarget) return;
        form.setValue(`${partnerTarget}.nome`, partner.razaoSocial);
        form.setValue(`${partnerTarget}.cnpj`, partner.cpfCnpj);
        setPartnerModalOpen(false);
        setPartnerTarget(null);
    };

    const openPartnerSearch = (target: 'emitente' | 'destinatario' | 'prestador' | 'tomador') => {
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
                prestador: values.prestador ? { nome: values.prestador.nome || null, cnpj: values.prestador.cnpj?.replace(/\D/g, '') || null } : null,
                tomador: values.tomador ? { nome: values.tomador.nome || null, cnpj: values.tomador.cnpj?.replace(/\D/g, '') || null } : null,
                updatedAt: serverTimestamp(),
            };
            
            if (mode === 'create') {
                dataToSave.createdAt = serverTimestamp();
            }

            if (values.produtos && values.produtos.length > 0) await upsertProductsFromLaunch(userId, company.id, values.produtos as Produto[]);
            const partnerType = dataToSave.type === 'entrada' ? 'fornecedor' : 'cliente';
            const partnerData = dataToSave.type === 'entrada' ? dataToSave.emitente : (dataToSave.destinatario || dataToSave.tomador);
            if (partnerData?.cnpj && partnerData?.nome) await upsertPartnerFromLaunch(userId, company.id, { cpfCnpj: partnerData.cnpj, razaoSocial: partnerData.nome, type: partnerType });
            
            const launchRef = mode === 'create' ? collection(db, `users/${userId}/companies/${company.id}/launches`) : doc(db, `users/${userId}/companies/${company.id}/launches`, launch!.id);
            if (mode === 'create') {
                await addDoc(launchRef, dataToSave);
                onLaunchSuccess(dataToSave.chaveNfe || `${dataToSave.numeroNfse}-${dataToSave.codigoVerificacaoNfse}-${dataToSave.versaoNfse}`, dataToSave.status);
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
        const { orcamento, xmlFile } = initialData;
        if(orcamento) return `Lançamento do Orçamento ${String(orcamento.quoteNumber).padStart(4, '0')}`;
        if (mode === 'create') return xmlFile ? 'Confirmar Lançamento de XML' : `Novo Lançamento Manual`;
        return mode === 'edit' ? 'Alterar Lançamento Fiscal' : 'Visualizar Lançamento Fiscal';
    };
    
     const renderPartyField = (partyName: 'emitente' | 'destinatario' | 'prestador' | 'tomador', label: string) => (
        <div className="space-y-4 rounded-md border p-4">
             <h4 className="font-semibold">{label}</h4>
            <FormField control={control} name={`${partyName}.nome`} render={({ field }) => ( <FormItem><FormLabel>Razão Social</FormLabel><div className="flex gap-2"><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl><Button type="button" variant="outline" size="icon" onClick={() => openPartnerSearch(partyName)} disabled={isReadOnly}><Search className="h-4 w-4"/></Button></div><FormMessage /></FormItem> )} />
            <FormField control={control} name={`${partyName}.cnpj`} render={({ field }) => ( <FormItem><FormLabel>CNPJ / CPF</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl><FormMessage /></FormItem> )} />
        </div>
    );

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-4xl">
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <DialogHeader>
                    <DialogTitle>{getTitle()}</DialogTitle>
                    <DialogDescription asChild>
                        <div>
                        <div className="flex items-center gap-2"><span>Tipo:</span><Badge variant="secondary" className="text-base capitalize">{form.getValues('type')}</Badge></div>
                        {(initialData.xmlFile || initialData.orcamento || initialData.launch?.fileName) && <p className="flex items-center gap-1.5 text-sm mt-1 text-muted-foreground"><FileText className="h-3.5 w-3.5" /><span>{form.getValues('fileName')}</span></p>}
                        </div>
                    </DialogDescription>
                    </DialogHeader>
                     <Tabs defaultValue="geral" className="w-full pt-4">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="geral">Geral</TabsTrigger>
                            <TabsTrigger value="itens">{watchedFormValues.type === 'servico' ? 'Serviços' : 'Produtos'}</TabsTrigger>
                            <TabsTrigger value="impostos">Impostos</TabsTrigger>
                        </TabsList>
                        <div className="py-4 max-h-[60vh] overflow-y-auto pr-4 mt-2">
                             <TabsContent value="geral" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={control} name="numeroNfse" render={({ field }) => ( <FormItem><FormLabel>Número da Nota</FormLabel><FormControl><Input {...field} readOnly={isReadOnly || !!initialData.xmlFile} /></FormControl></FormItem> )} />
                                    <FormField control={control} name="chaveNfe" render={({ field }) => ( <FormItem><FormLabel>Chave de Acesso</FormLabel><FormControl><Input {...field} readOnly={isReadOnly || !!initialData.xmlFile} /></FormControl></FormItem> )} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={control} name="date" render={({ field }) => (<FormItem><FormLabel>Data de Emissão/Competência</FormLabel><FormControl><DateInput value={field.value} onChange={field.onChange} readOnly={isReadOnly} /></FormControl></FormItem>)} />
                                    <FormField control={control} name="status" render={({ field }) => (<FormItem><FormLabel>Status da Nota Fiscal</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem><SelectItem value="Substituida">Substituída</SelectItem></SelectContent></Select></FormItem>)} />
                                </div>
                                <Separator />
                                {watchedFormValues.type === 'servico' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderPartyField('prestador', 'Prestador do Serviço')}
                                        {renderPartyField('tomador', 'Tomador do Serviço')}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderPartyField('emitente', 'Emitente')}
                                        {renderPartyField('destinatario', 'Destinatário')}
                                    </div>
                                )}
                                <FormField control={control} name="observacoes" render={({ field }) => ( <FormItem><FormLabel>Observações Internas</FormLabel><FormControl><Textarea {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                            </TabsContent>

                            <TabsContent value="itens" className="space-y-4">
                                 {watchedFormValues.type === 'servico' ? (
                                    <div className="space-y-4">
                                        <FormField control={control} name="discriminacao" render={({ field }) => ( <FormItem><FormLabel>Discriminação do Serviço</FormLabel><FormControl><Textarea {...field} readOnly={isReadOnly} rows={5} /></FormControl></FormItem> )} />
                                        <div className="grid grid-cols-3 gap-4">
                                            <FormField control={control} name="itemLc116" render={({ field }) => ( <FormItem><FormLabel>Item LC 116</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name="valorServicos" render={({ field }) => ( <FormItem><FormLabel>Valor dos Serviços</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                            <FormField control={control} name="valorLiquido" render={({ field }) => ( <FormItem><FormLabel>Valor Líquido</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly className="font-semibold" /></FormControl></FormItem> )} />
                                        </div>
                                    </div>
                                ) : (
                                     <div className="space-y-4">
                                        {fields.map((item, index) => (
                                            <div key={item.id} className="p-3 border rounded-md bg-muted/50 relative">
                                                <div className="grid grid-cols-12 gap-x-2 gap-y-4 items-end">
                                                    <FormField control={control} name={`produtos.${index}.codigo`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel className="text-xs">Código</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem>)} />
                                                    <FormField control={control} name={`produtos.${index}.descricao`} render={({ field }) => (<FormItem className="col-span-9"><FormLabel className="text-xs">Descrição</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem>)} />
                                                    <FormField control={control} name={`produtos.${index}.quantidade`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel className="text-xs">Qtd.</FormLabel><FormControl><Input type="number" {...field} onBlur={() => updateProductTotal(index)} readOnly={isReadOnly}/></FormControl></FormItem>)} />
                                                    <FormField control={control} name={`produtos.${index}.valorUnitario`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel className="text-xs">Vlr. Unitário</FormLabel><FormControl><Input type="number" step="0.01" {...field} onBlur={() => updateProductTotal(index)} readOnly={isReadOnly}/></FormControl></FormItem>)} />
                                                    <FormField control={control} name={`produtos.${index}.valorTotal`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel className="text-xs">Vlr. Total</FormLabel><FormControl><Input type="number" {...field} readOnly className="font-semibold"/></FormControl></FormItem>)} />
                                                    <div className="col-span-3 flex justify-end">
                                                    {!isReadOnly && <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {!isReadOnly && (
                                            <Button type="button" variant="outline" className="w-full mt-2" onClick={() => append({ codigo: '', descricao: '', ncm: '', cfop: '', quantidade: 1, valorUnitario: 0, valorTotal: 0 })}>
                                                <PlusCircle className="mr-2 h-4 w-4"/> Adicionar Produto
                                            </Button>
                                        )}
                                        <Separator className="my-4"/>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={control} name="valorProdutos" render={({ field }) => ( <FormItem><FormLabel>Valor Total dos Produtos</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly /></FormControl></FormItem> )} />
                                            <FormField control={control} name="valorTotalNota" render={({ field }) => ( <FormItem><FormLabel>Valor Total da Nota</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly /></FormControl></FormItem> )} />
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                             <TabsContent value="impostos">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-1">
                                    <FormField control={control} name="valorPis" render={({ field }) => ( <FormItem><FormLabel>PIS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    <FormField control={control} name="valorCofins" render={({ field }) => ( <FormItem><FormLabel>COFINS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    <FormField control={control} name="valorCsll" render={({ field }) => ( <FormItem><FormLabel>CSLL</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    <FormField control={control} name="valorIr" render={({ field }) => ( <FormItem><FormLabel>IR</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    <FormField control={control} name="valorInss" render={({ field }) => ( <FormItem><FormLabel>INSS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    {watchedFormValues.type === 'servico' ? (
                                    <FormField control={control} name="valorIss" render={({ field }) => ( <FormItem><FormLabel>ISS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    ) : (
                                    <>
                                    <FormField control={control} name="valorIcms" render={({ field }) => ( <FormItem><FormLabel>ICMS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    <FormField control={control} name="valorIpi" render={({ field }) => ( <FormItem><FormLabel>IPI</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                                    </>
                                    )}
                                </div>
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
                    partnerType={partnerTarget === 'emitente' || partnerTarget === 'prestador' ? 'fornecedor' : 'cliente'}
                />
            )}
        </>
    );
};
