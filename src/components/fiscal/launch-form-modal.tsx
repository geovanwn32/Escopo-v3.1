
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
import { Loader2, Search, Save, Bot, PlusCircle, Trash2 } from 'lucide-react';
import { Launch, Company } from '@/types';
import { isValid } from 'date-fns';
import { Textarea } from '../ui/textarea';
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
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};


interface XmlFile {
  file: { name: string; type: string; size: number; lastModified: number; };
  content: string;
  status: 'pending' | 'launched' | 'error' | 'cancelled';
  type: 'entrada' | 'saida' | 'servico' | 'desconhecido' | 'cancelamento';
  key?: string;
  versaoNfse?: string;
  numero?: string;
  valor?: number;
}

export interface OpenModalOptions {
  xmlFile?: XmlFile | null;
  launch?: Launch | null;
  orcamento?: Orcamento | null;
  orcamentoId?: string | null;
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
    cst: z.string().optional().nullable(),
    cfop: z.string().optional().nullable(),
    unidade: z.string().optional().nullable(),
    quantidade: z.coerce.number().default(1),
    valorUnitario: z.coerce.number().default(0),
    valorTotal: z.coerce.number().default(0),
    baseCalculoIcms: z.coerce.number().optional().nullable(),
    valorIcms: z.coerce.number().optional().nullable(),
    valorIpi: z.coerce.number().optional().nullable(),
    aliqIcms: z.coerce.number().optional().nullable(),
    aliqIpi: z.coerce.number().optional().nullable(),
});

const launchSchema = z.object({
  fileName: z.string().default(''),
  type: z.enum(['entrada', 'saida', 'servico']),
  status: z.enum(['Normal', 'Cancelado', 'Substituida']),
  date: z.date({ required_error: "A data é obrigatória." }),
  observacoes: z.string().optional().nullable(),
  
  // NF-e fields
  chaveNfe: z.string().optional().nullable(),
  modalidadeFrete: z.string().optional().nullable(),

  // NFS-e fields
  numeroNfse: z.string().optional().nullable(),
  codigoVerificacaoNfse: z.string().optional().nullable(),
  discriminacao: z.string().optional().nullable(),
  itemLc116: z.string().optional().nullable(),
  
  serie: z.string().optional().nullable(),

  // Parties
  emitente: partySchema,
  destinatario: partySchema,
  prestador: partySchema,
  tomador: partySchema,

  // NF-e Values
  valorProdutos: z.coerce.number().optional().nullable(),
  valorFrete: z.coerce.number().optional().nullable(),
  valorSeguro: z.coerce.number().optional().nullable(),
  valorOutrasDespesas: z.coerce.number().optional().nullable(),

  // NFS-e Values
  valorServicos: z.coerce.number().optional().nullable(),
  
  // Common Values
  valorTotalNota: z.coerce.number().optional().nullable(),
  valorPis: z.coerce.number().optional().nullable(),
  valorCofins: z.coerce.number().optional().nullable(),
  valorIr: z.coerce.number().optional().nullable(),
  valorInss: z.coerce.number().optional().nullable(),
  valorCsll: z.coerce.number().optional().nullable(),
  valorIss: z.coerce.number().optional().nullable(),
  valorIpi: z.coerce.number().optional().nullable(),
  valorIcms: z.coerce.number().optional().nullable(),
  valorLiquido: z.coerce.number().optional().nullable(),
  
  aliqPis: z.coerce.number().optional().nullable(),
  aliqCofins: z.coerce.number().optional().nullable(),
  aliqIr: z.coerce.number().optional().nullable(),
  aliqInss: z.coerce.number().optional().nullable(),
  aliqCsll: z.coerce.number().optional().nullable(),
  aliqIss: z.coerce.number().optional().nullable(),

  // Products
  produtos: z.array(productSchema).optional(),
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

function parseNfeXml(xmlDoc: Document, companyCnpj: string): Partial<FormData> {
    const data: Partial<FormData> = { produtos: [] };
    const infNFe = xmlDoc.querySelector('infNFe');
    if (!infNFe) return {};

    const emitCnpj = querySelectorText(infNFe.querySelector('emit'), ['CNPJ', 'CPF']).replace(/\D/g, '');
    data.type = emitCnpj === companyCnpj ? 'saida' : 'entrada';
    data.chaveNfe = infNFe.getAttribute('Id')?.replace('NFe', '') || '';

    const ide = infNFe.querySelector('ide');
    const dateStr = querySelectorText(ide, ['dhEmi']);
    if (dateStr) data.date = new Date(dateStr);
    data.serie = querySelectorText(ide, ['serie']);
    data.numeroNfse = querySelectorText(ide, ['nNF']); // Reusing for NF number

    data.emitente = {
        nome: querySelectorText(infNFe.querySelector('emit'), ['xNome']),
        cnpj: emitCnpj,
    };
    data.destinatario = {
        nome: querySelectorText(infNFe.querySelector('dest'), ['xNome']),
        cnpj: querySelectorText(infNFe.querySelector('dest'), ['CNPJ', 'CPF']).replace(/\D/g, ''),
    };

    const total = infNFe.querySelector('total > ICMSTot');
    data.valorTotalNota = getFloat(total, 'vNF');
    data.valorProdutos = getFloat(total, 'vProd');
    data.valorFrete = getFloat(total, 'vFrete');
    data.valorSeguro = getFloat(total, 'vSeg');
    data.valorOutrasDespesas = getFloat(total, 'vOutro');
    data.valorPis = getFloat(total, 'vPIS');
    data.valorCofins = getFloat(total, 'vCOFINS');
    data.valorIcms = getFloat(total, 'vICMS');
    data.valorIpi = getFloat(total, 'vIPI');
    data.valorLiquido = getFloat(total, 'vNF'); // For NF-e, liquid is usually the same as total

    xmlDoc.querySelectorAll('det').forEach(det => {
        const prod = det.querySelector('prod');
        const imposto = det.querySelector('imposto');
        const icmsNode = imposto?.querySelector('ICMS > *');
        const ipiNode = imposto?.querySelector('IPI > IPITrib');
        
        data.produtos?.push({
            codigo: querySelectorText(prod, ['cProd']),
            descricao: querySelectorText(prod, ['xProd']),
            ncm: querySelectorText(prod, ['NCM']),
            cfop: querySelectorText(prod, ['CFOP']),
            unidade: querySelectorText(prod, ['uCom']),
            cst: querySelectorText(icmsNode, ['CST', 'CSOSN']),
            quantidade: getFloat(prod, 'qCom'),
            valorUnitario: getFloat(prod, 'vUnCom'),
            valorTotal: getFloat(prod, 'vProd'),
            baseCalculoIcms: getFloat(icmsNode, 'vBC'),
            valorIcms: getFloat(icmsNode, 'vICMS'),
            aliqIcms: getFloat(icmsNode, 'pICMS'),
            valorIpi: getFloat(ipiNode, 'vIPI'),
            aliqIpi: getFloat(ipiNode, 'pIPI'),
        });
    });
    
    data.modalidadeFrete = querySelectorText(infNFe.querySelector('transp'), ['modFrete']);

    return data;
}


function parseNfseXml(xmlDoc: Document, companyCnpj: string): Partial<FormData> {
    const data: Partial<FormData> = {};
    const infNfse = xmlDoc.querySelector('infNFSe') || xmlDoc.querySelector('InfNfse') || xmlDoc.querySelector('NFSe > infNFSe');
    if (!infNfse) return {};

    const prestadorCnpj = querySelectorText(infNfse, ['PrestadorServico > CpfCnpj > Cnpj', 'prest > CNPJ']).replace(/\D/g, '');
    const tomadorCnpj = querySelectorText(infNfse, ['TomadorServico > CpfCnpj > Cnpj', 'toma > CNPJ']).replace(/\D/g, '');
    
    data.type = prestadorCnpj === companyCnpj ? 'servico' : 'entrada';
    
    const dateString = querySelectorText(infNfse, ['dhProc', 'dhEmi', 'dCompet', 'DPS > infDPS > dhEmi']);
    if (dateString) {
        const tempDate = new Date(dateString.split('T')[0]);
        data.date = new Date(tempDate.getTime() + (tempDate.getTimezoneOffset() * 60000));
    }
    data.numeroNfse = querySelectorText(infNfse, ['nNFSe', 'Numero', 'DPS > infDPS > nDPS']);
    data.codigoVerificacaoNfse = querySelectorText(infNfse, ['CodigoVerificacao']);

    const serviceNode = xmlDoc.querySelector('serv') || infNfse.querySelector('Servico') || infNfse;
    data.discriminacao = querySelectorText(serviceNode, ['xDescServ', 'Discriminacao']);
    data.itemLc116 = querySelectorText(serviceNode, ['cServ > cTribNac', 'ItemListaServico']);

    const valoresNode = xmlDoc.querySelector('valores') || serviceNode.querySelector('Valores') || infNfse.querySelector('DPS > infDPS > valores');
    data.valorServicos = getFloat(valoresNode, 'ValorServicos');
    data.valorIss = getFloat(valoresNode, 'ValorIss');
    data.valorPis = getFloat(valoresNode, 'vPIS');
    data.valorCofins = getFloat(valoresNode, 'vCOFINS');
    data.valorIr = getFloat(valoresNode, 'vIR');
    data.valorInss = getFloat(valoresNode, 'vINSS');
    data.valorCsll = getFloat(valoresNode, 'vCSLL');
    data.valorTotalNota = getFloat(valoresNode, 'vLiq') || getFloat(valoresNode, 'ValorServicos'); // vLiq or fallback to vServicos
    data.valorLiquido = getFloat(valoresNode, 'ValorLiquidoNfse');

    data.prestador = {
        nome: querySelectorText(xmlDoc, ['emit > xNome', 'PrestadorServico > RazaoSocial', 'prest > xNome', 'emit > xNome']),
        cnpj: prestadorCnpj,
    };
    data.tomador = {
        nome: querySelectorText(xmlDoc, ['toma > xNome', 'TomadorServico > RazaoSocial', 'DPS > infDPS > toma > xNome']),
        cnpj: tomadorCnpj,
    };

    return data;
}

function parseXml(xmlString: string, companyCnpj: string): Partial<FormData> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    if (xmlDoc.querySelector("parsererror")) {
        throw new Error("Erro ao analisar o XML.");
    }
    
    if (xmlDoc.querySelector('infNFe')) {
        return parseNfeXml(xmlDoc, companyCnpj);
    } else if (xmlDoc.querySelector('CompNfse') || xmlDoc.querySelector('ConsultarNfseServicoPrestadoResposta') || xmlDoc.querySelector('NFSe')) {
        return parseNfseXml(xmlDoc, companyCnpj);
    }
    
    throw new Error("Formato de XML não reconhecido (nem NF-e, nem NFS-e).");
}


const defaultLaunchValues: Partial<FormData> = {
    fileName: '',
    status: 'Normal',
    date: new Date(),
    serie: '',
    observacoes: '',
    emitente: { nome: '', cnpj: '' },
    destinatario: { nome: '', cnpj: '' },
    prestador: { nome: '', cnpj: '' },
    tomador: { nome: '', cnpj: '' },
    valorProdutos: 0,
    valorServicos: 0,
    valorTotalNota: 0,
    valorPis: 0,
    valorCofins: 0,
    valorIr: 0,
    valorInss: 0,
    valorCsll: 0,
    valorIss: 0,
    valorIpi: 0,
    valorIcms: 0,
    valorLiquido: 0,
    produtos: [],
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
    const [launchType, setLaunchType] = useState<'entrada' | 'saida' | 'servico'>(initialData.manualLaunchType || 'servico');
    
    const { toast } = useToast();

    const form = useForm<FormData>({ 
        resolver: zodResolver(launchSchema),
        defaultValues: defaultLaunchValues as FormData,
    });
    const { control, setValue, reset, getValues } = form;

     const { fields, append, remove } = useFieldArray({
        control,
        name: "produtos",
    });

    const watchedFields = useWatch({ control });

    // Centralized calculation logic
    useEffect(() => {
        const {
            valorProdutos = 0, valorServicos = 0, valorFrete = 0, valorSeguro = 0,
            valorOutrasDespesas = 0, valorIpi = 0, valorPis = 0, valorCofins = 0,
            valorCsll = 0, valorIr = 0, valorInss = 0, valorIss = 0,
            produtos = []
        } = watchedFields;

        // 1. Calculate total from products if they exist
        const totalFromProducts = produtos.reduce((sum, p) => sum + ((p.quantidade || 0) * (p.valorUnitario || 0)), 0);
        if (Math.abs(totalFromProducts - (valorProdutos || 0)) > 0.001) {
            setValue('valorProdutos', totalFromProducts, { shouldValidate: true });
        }
        
        // 2. Calculate Gross Total (Valor Total da Nota)
        const totalBruto = (launchType === 'servico' ? valorServicos : valorProdutos) + valorFrete + valorSeguro + valorOutrasDespesas + valorIpi;
        
        // Only update if it wasn't pre-filled by XML or if it's a manual entry
        const currentTotalNota = getValues('valorTotalNota') || 0;
        const xmlFileExists = !!initialData.xmlFile;

        if (!xmlFileExists || currentTotalNota === 0) {
             setValue('valorTotalNota', totalBruto, { shouldValidate: true });
        }
        
        // 3. Calculate Net Total (Valor Líquido)
        const totalDeducoes = valorPis + valorCofins + valorCsll + valorIr + valorInss + valorIss;
        const valorLiquidoFinal = (getValues('valorTotalNota') || totalBruto) - totalDeducoes;
        setValue('valorLiquido', valorLiquidoFinal, { shouldValidate: true });

    }, [watchedFields, launchType, setValue, getValues, initialData.xmlFile]);

    const fillAndSetInitialData = useCallback((data: Partial<FormData>) => {
        reset({
            ...defaultLaunchValues,
            ...data,
        });
        if (data.type) {
            setLaunchType(data.type);
        }
    }, [reset]);

    useEffect(() => {
        if (isOpen) {
            const { mode = 'create', launch, xmlFile } = initialData;

            if (mode === 'edit' || mode === 'view') {
                fillAndSetInitialData(launch || {});
            } else if (xmlFile) {
                try {
                    const parsedData = parseXml(xmlFile.content, company.cnpj.replace(/\D/g, ''));
                    fillAndSetInitialData({ ...parsedData, fileName: xmlFile.name });
                } catch (error) {
                    toast({ variant: 'destructive', title: 'Erro ao Processar XML', description: (error as Error).message });
                    onClose();
                }
            } else { // Manual launch
                const manualType = initialData.manualLaunchType || 'servico';
                fillAndSetInitialData({ type: manualType });
                setLaunchType(manualType);

                 if (manualType === 'servico' || manualType === 'saida') {
                    const partyField = manualType === 'servico' ? 'prestador' : 'emitente';
                    setValue(`${partyField}.nome`, company.razaoSocial);
                    setValue(`${partyField}.cnpj`, company.cnpj);
                 } else { // entrada
                    setValue('destinatario.nome', company.razaoSocial);
                    setValue('destinatario.cnpj', company.cnpj);
                 }
            }
        }
    }, [isOpen, initialData, company, fillAndSetInitialData, toast, onClose, setValue]);
  
    const mode = initialData.launch ? 'edit' : 'create';

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
        setLoading(true);
        try {
            const dataToSave: Partial<Launch> = { ...values };
            Object.keys(dataToSave).forEach(key => {
                const k = key as keyof typeof dataToSave;
                if ((dataToSave as any)[k] === undefined) {
                    (dataToSave as any)[k] = null;
                }
            });

            dataToSave.updatedAt = serverTimestamp();
            
            if (mode === 'create') {
                dataToSave.createdAt = serverTimestamp();
                 if (dataToSave.produtos) {
                    await upsertProductsFromLaunch(userId, company.id, dataToSave.produtos);
                }
                const partnerData = dataToSave.type === 'entrada' ? dataToSave.emitente : (dataToSave.destinatario || dataToSave.tomador);
                 if (partnerData?.cnpj && partnerData?.nome) {
                    await upsertPartnerFromLaunch(userId, company.id, {
                        cpfCnpj: partnerData.cnpj,
                        razaoSocial: partnerData.nome,
                        type: dataToSave.type === 'entrada' ? 'fornecedor' : 'cliente'
                    });
                }
            } else {
                 delete (dataToSave as any).createdAt;
            }

            const launchRef = mode === 'create' ? collection(db, `users/${userId}/companies/${company.id}/launches`) : doc(db, `users/${userId}/companies/${company.id}/launches`, initialData.launch!.id);
            if (mode === 'create') {
                await addDoc(launchRef, dataToSave);
                toast({ title: "Lançamento Criado!", description: `A nota foi salva com sucesso.` });
            } else {
                await updateDoc(launchRef as any, dataToSave);
                 toast({ title: "Lançamento Atualizado!", description: `As alterações foram salvas com sucesso.`});
            }

            if(initialData.xmlFile?.key) {
                onLaunchSuccess(initialData.xmlFile.key, values.status);
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
        if (mode === 'create') return `Novo Lançamento Manual`;
        return `Alterar Lançamento`;
    };
    
    const renderPartyField = (partyName: 'emitente' | 'destinatario' | 'prestador' | 'tomador', label: string) => (
        <div className="space-y-4 rounded-md border p-4">
             <h4 className="font-semibold">{label}</h4>
            <FormField control={control} name={`${partyName}.nome`} render={({ field }) => ( <FormItem><FormLabel>Razão Social</FormLabel><div className="flex gap-2"><FormControl><Input {...field} value={field.value || ''}  /></FormControl><Button type="button" variant="outline" size="icon" onClick={() => openPartnerSearch(partyName)}><Search className="h-4 w-4"/></Button></div><FormMessage /></FormItem> )} />
            <FormField control={control} name={`${partyName}.cnpj`} render={({ field }) => ( <FormItem><FormLabel>CNPJ / CPF</FormLabel><FormControl><Input {...field} value={field.value || ''}  /></FormControl><FormMessage /></FormItem> )} />
        </div>
    );

    const isNFe = launchType === 'entrada' || launchType === 'saida';

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl w-full">
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
                    <DialogHeader>
                    <DialogTitle>{getTitle()}</DialogTitle>
                    <DialogDescription>
                        {mode === 'create' ? 'Preencha os dados da nota fiscal.' : 'Altere os dados da nota fiscal.'}
                    </DialogDescription>
                    </DialogHeader>
                    
                     <div className="py-4">
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>Tipo:</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                    onValueChange={(value) => {
                                        field.onChange(value);
                                        setLaunchType(value as any);
                                    }}
                                    value={field.value}
                                    className="flex space-x-2"
                                    >
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="servico" /></FormControl>
                                            <FormLabel className="font-normal">Serviço</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="entrada" /></FormControl>
                                            <FormLabel className="font-normal">Entrada (NF-e)</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="saida" /></FormControl>
                                            <FormLabel className="font-normal">Saída (NF-e)</FormLabel>
                                        </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                     <Tabs defaultValue="geral" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="geral">Geral</TabsTrigger>
                            <TabsTrigger value="parties">Partes</TabsTrigger>
                            <TabsTrigger value="details">{isNFe ? 'Produtos' : 'Detalhes'}</TabsTrigger>
                            <TabsTrigger value="taxes">Tributos</TabsTrigger>
                        </TabsList>
                        <div className="py-4 max-h-[50vh] overflow-y-auto pr-4 mt-2">
                             <TabsContent value="geral" className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                     <FormField control={control} name="numeroNfse" render={({ field }) => ( <FormItem><FormLabel>Número da Nota</FormLabel><FormControl><Input {...field} value={field.value || ''}  /></FormControl></FormItem> )} />
                                    <FormField control={control} name="serie" render={({ field }) => ( <FormItem><FormLabel>Série</FormLabel><FormControl><Input {...field} value={field.value || ''}  /></FormControl></FormItem> )} />
                                    <FormField control={control} name="date" render={({ field }) => (<FormItem><FormLabel>Data de Emissão</FormLabel><FormControl><DateInput value={field.value} onChange={field.onChange}  /></FormControl></FormItem>)} />
                                </div>
                                <FormField control={control} name="chaveNfe" render={({ field }) => ( <FormItem><FormLabel>Chave da NF-e</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                                 <FormField control={control} name="status" render={({ field }) => (<FormItem><FormLabel>Status da Nota</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem><SelectItem value="Substituida">Substituída</SelectItem></SelectContent></Select></FormItem>)} />
                            </TabsContent>

                            <TabsContent value="parties" className="space-y-4">
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {renderPartyField(isNFe ? 'emitente' : 'prestador', isNFe ? 'Emitente' : 'Prestador')}
                                    {renderPartyField(isNFe ? 'destinatario' : 'tomador', isNFe ? 'Destinatário' : 'Tomador')}
                                </div>
                            </TabsContent>

                             <TabsContent value="details" className="space-y-4">
                                {isNFe ? (
                                    <div className="space-y-3">
                                    {fields.map((item, index) => {
                                        const watchedItem = watchedFields.produtos?.[index];
                                        const total = (watchedItem?.quantidade || 0) * (watchedItem?.valorUnitario || 0);

                                        return (
                                        <div key={item.id} className="p-3 border rounded-lg space-y-2 relative">
                                             <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                             <FormField control={control} name={`produtos.${index}.descricao`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Descrição</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                                             <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                 <FormField control={control} name={`produtos.${index}.quantidade`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Qtd</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )} />
                                                 <FormField control={control} name={`produtos.${index}.valorUnitario`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Vlr. Unit.</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem> )} />
                                                 <FormItem><FormLabel className="text-xs">Vlr. Total</FormLabel><Input readOnly value={formatCurrency(total)} className="font-semibold bg-muted" /></FormItem>
                                                 <FormField control={control} name={`produtos.${index}.cfop`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">CFOP</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                             </div>
                                             <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                 <FormField control={control} name={`produtos.${index}.ncm`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">NCM</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                                 <FormField control={control} name={`produtos.${index}.cst`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">CST/CSOSN</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                                 <FormField control={control} name={`produtos.${index}.valorIcms`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Vlr. ICMS</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                             </div>
                                             <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                <FormField control={control} name={`produtos.${index}.aliqIcms`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Alíq. ICMS (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                                <FormField control={control} name={`produtos.${index}.valorIpi`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Vlr. IPI</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                                <FormField control={control} name={`produtos.${index}.aliqIpi`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Alíq. IPI (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                             </div>
                                        </div>
                                        );
                                    })}
                                     <Button type="button" variant="outline" size="sm" onClick={() => append({ ...productSchema.parse({}) })}><PlusCircle className="mr-2 h-4 w-4"/>Adicionar Produto</Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <FormField control={control} name="discriminacao" render={({ field }) => ( <FormItem><FormLabel>Discriminação dos Serviços</FormLabel><FormControl><Textarea {...field} value={field.value || ''}  rows={10} /></FormControl></FormItem> )} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={control} name="itemLc116" render={({ field }) => ( <FormItem><FormLabel>Item da Lista (LC 116)</FormLabel><FormControl><Input {...field} value={field.value || ''}  /></FormControl></FormItem> )} />
                                            <FormField control={control} name="codigoVerificacaoNfse" render={({ field }) => ( <FormItem><FormLabel>Código de Verificação</FormLabel><FormControl><Input {...field} value={field.value || ''}  /></FormControl></FormItem> )} />
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                            
                             <TabsContent value="taxes" className="space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                                     <FormField control={control} name={"valorServicos"} render={({ field }) => ( <FormItem><FormLabel>Valor dos Serviços</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     
                                     <FormField control={form.control} name="aliqIss" render={({ field }) => (<FormItem><FormLabel>Alíq. ISS (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                                     <FormField control={control} name="valorIss" render={({ field }) => ( <FormItem><FormLabel>Valor do ISS</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     <div></div>
                                     
                                     <FormField control={form.control} name="aliqPis" render={({ field }) => (<FormItem><FormLabel>Alíq. PIS (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                                     <FormField control={control} name="valorPis" render={({ field }) => ( <FormItem><FormLabel>Valor do PIS</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     
                                     <FormField control={form.control} name="aliqCofins" render={({ field }) => (<FormItem><FormLabel>Alíq. COFINS (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                                     <FormField control={control} name="valorCofins" render={({ field }) => ( <FormItem><FormLabel>Valor do COFINS</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     
                                     <FormField control={form.control} name="aliqCsll" render={({ field }) => (<FormItem><FormLabel>Alíq. CSLL (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                                     <FormField control={control} name="valorCsll" render={({ field }) => ( <FormItem><FormLabel>Valor do CSLL</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />

                                     <FormField control={form.control} name="aliqInss" render={({ field }) => (<FormItem><FormLabel>Alíq. INSS (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                                     <FormField control={control} name="valorInss" render={({ field }) => ( <FormItem><FormLabel>Valor do INSS</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     
                                     <FormField control={form.control} name="aliqIr" render={({ field }) => (<FormItem><FormLabel>Alíq. IR (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                                     <FormField control={control} name="valorIr" render={({ field }) => ( <FormItem><FormLabel>Valor do IR</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     
                                </div>
                                <Separator />
                                <div className="grid grid-cols-2 gap-4">
                                     <FormField control={control} name="valorTotalNota" render={({ field }) => ( <FormItem><FormLabel>Valor Total da Nota</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0} className="font-semibold border-primary" /></FormControl></FormItem> )} />
                                     <FormField control={control} name="valorLiquido" render={({ field }) => ( <FormItem><FormLabel>Valor Líquido da Nota</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0} className="font-semibold border-primary" /></FormControl></FormItem> )} />
                                </div>
                            </TabsContent>

                        </div>
                    </Tabs>
                    <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
                        {mode === 'create' ? 'Confirmar Lançamento' : 'Salvar Alterações'}
                    </Button>
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
