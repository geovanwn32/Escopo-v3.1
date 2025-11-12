
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
import { Loader2, Search, Save, Bot } from 'lucide-react';
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
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';


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
  type: z.literal('servico').default('servico'),
  status: z.enum(['Normal', 'Cancelado', 'Substituida']),
  date: z.date({ required_error: "A data é obrigatória." }),
  observacoes: z.string().optional().nullable(),
  
  // NFS-e fields
  numeroNfse: z.string().optional().nullable(),
  codigoVerificacaoNfse: z.string().optional().nullable(),
  discriminacao: z.string().optional().nullable(),
  itemLc116: z.string().optional().nullable(),
  
  serie: z.string().optional().nullable(),

  prestador: partySchema,
  tomador: partySchema,

  valorServicos: z.coerce.number().optional().nullable(),
  valorTotalNota: z.coerce.number().optional().nullable(),
  valorPis: z.coerce.number().optional().nullable(),
  valorCofins: z.coerce.number().optional().nullable(),
  valorIr: z.coerce.number().optional().nullable(),
  valorInss: z.coerce.number().optional().nullable(),
  valorCsll: z.coerce.number().optional().nullable(),
  valorIss: z.coerce.number().optional().nullable(),
  valorLiquido: z.coerce.number().optional().nullable(),
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

function parseXmlForService(xmlString: string): Partial<FormData> | { error: string } {
    if (!xmlString || !xmlString.trim().startsWith('<')) {
        return { error: 'O texto fornecido não é um XML válido.' };
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const errorNode = xmlDoc.querySelector("parsererror");
    
    if (errorNode) {
        console.error("Error parsing XML:", errorNode.textContent);
        return { error: `Erro ao analisar o XML: ${errorNode.textContent}` };
    }

    const data: Partial<FormData> = {};
    const infNfse = xmlDoc.querySelector('infNFSe') || xmlDoc.querySelector('InfNfse') || xmlDoc.querySelector('NFSe > infNFSe');
    if(infNfse) {
        const dateString = querySelectorText(infNfse, ['dhProc', 'dhEmi', 'dCompet', 'DPS > infDPS > dhEmi']);
        if (dateString) {
            const tempDate = new Date(dateString.split('T')[0]);
            const timezoneOffset = tempDate.getTimezoneOffset() * 60000;
            data.date = new Date(tempDate.getTime() + timezoneOffset);
        }
        data.numeroNfse = querySelectorText(infNfse, ['nNFSe', 'Numero', 'DPS > infDPS > nDPS']);
        data.codigoVerificacaoNfse = querySelectorText(infNfse, ['CodigoVerificacao']);
        
        const serviceNode = xmlDoc.querySelector('serv') || infNfse.querySelector('Servico') || infNfse;
        data.discriminacao = querySelectorText(serviceNode, ['xDescServ', 'Discriminacao']);
        data.itemLc116 = querySelectorText(serviceNode, ['cServ > cTribNac', 'ItemListaServico']);

        const valoresNode = xmlDoc.querySelector('valores') || serviceNode.querySelector('Valores') || infNfse.querySelector('DPS > infDPS > valores');
        data.valorServicos = getFloat(valoresNode, ['vServPrest > vServ', 'vServ', 'ValorServicos']);
        data.valorIss = getFloat(valoresNode, ['vISS', 'ValorIss']);
        data.valorTotalNota = data.valorServicos; // Simplified
        data.valorLiquido = getFloat(valoresNode, ['vLiq', 'ValorLiquidoNfse']);

        data.prestador = {
            nome: querySelectorText(xmlDoc, ['emit > xNome', 'PrestadorServico > RazaoSocial', 'prest > xNome', 'emit > xNome']),
            cnpj: querySelectorText(xmlDoc, ['emit > CNPJ', 'PrestadorServico > CpfCnpj > Cnpj', 'prest > CNPJ']),
        }
        data.tomador = {
            nome: querySelectorText(xmlDoc, ['toma > xNome', 'TomadorServico > RazaoSocial', 'DPS > infDPS > toma > xNome']),
            cnpj: querySelectorText(xmlDoc, ['toma > CNPJ', 'toma > CPF', 'TomadorServico > CpfCnpj > Cnpj', 'TomadorServico > CpfCnpj > Cpf', 'DPS > infDPS > toma > CNPJ']),
        }
    } else {
        return { error: 'Formato de NFS-e não reconhecido.' };
    }
    
    return data;
}

const defaultLaunchValues: Partial<FormData> = {
    fileName: '',
    status: 'Normal',
    date: new Date(),
    serie: '',
    observacoes: '',
    prestador: { nome: '', cnpj: '' },
    tomador: { nome: '', cnpj: '' },
    valorServicos: 0,
    valorTotalNota: 0,
    valorPis: 0,
    valorCofins: 0,
    valorIr: 0,
    valorInss: 0,
    valorCsll: 0,
    valorIss: 0,
    valorLiquido: 0,
};

const getInitialData = (
    options: OpenModalOptions,
    company: Company,
): Partial<FormData> => {
    const { mode = 'create', launch } = options;

    if (mode === 'edit' || mode === 'view') {
        return { 
            ...defaultLaunchValues, 
            ...launch,
            prestador: { nome: launch?.prestador?.nome || '', cnpj: launch?.prestador?.cnpj || '' },
            tomador: { nome: launch?.tomador?.nome || '', cnpj: launch?.tomador?.cnpj || '' },
         };
    }

    // Default for creating a new manual service note
    return {
        ...defaultLaunchValues,
        type: 'servico',
        date: new Date(),
        fileName: 'Lançamento Manual de Serviço',
        status: 'Normal',
    };
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
    const [partnerTarget, setPartnerTarget] = useState<'prestador' | 'tomador' | null>(null);
    const [loading, setLoading] = useState(false);
    const [serviceType, setServiceType] = useState<'prestado' | 'tomado'>('prestado');
    const [xmlContent, setXmlContent] = useState('');

    const { toast } = useToast();

    const form = useForm<FormData>({ 
        resolver: zodResolver(launchSchema),
        defaultValues: defaultLaunchValues,
    });
    const { control, setValue, reset, watch } = form;

    const watchedValues = watch(['valorServicos', 'valorPis', 'valorCofins', 'valorIss', 'valorIr', 'valorInss', 'valorCsll']);

    useEffect(() => {
        const [vlrServicos, vlrPis, vlrCofins, vlrIss, vlrIr, vlrInss, vlrCsll] = watchedValues;
        const totalDeductions = (vlrPis || 0) + (vlrCofins || 0) + (vlrIss || 0) + (vlrIr || 0) + (vlrInss || 0) + (vlrCsll || 0);
        const liquidValue = (vlrServicos || 0) - totalDeductions;
        setValue('valorLiquido', parseFloat(liquidValue.toFixed(2)));
        setValue('valorTotalNota', parseFloat((vlrServicos || 0).toFixed(2)));
    }, [watchedValues, setValue]);


    useEffect(() => {
        if (isOpen) {
            setXmlContent('');
            const data = getInitialData(initialData, company);
            reset(data);

            // Determine if it's a "prestado" or "tomado" service on load
            const companyCnpj = company.cnpj?.replace(/\D/g, '');
            if (data.prestador?.cnpj?.replace(/\D/g, '') === companyCnpj) {
                setServiceType('prestado');
            } else if (data.tomador?.cnpj?.replace(/\D/g, '') === companyCnpj) {
                setServiceType('tomado');
            } else {
                 setServiceType('prestado'); // Default
                 if (initialData.mode !== 'edit' && initialData.mode !== 'view') {
                     setValue('prestador.nome', company.razaoSocial);
                     setValue('prestador.cnpj', company.cnpj);
                 }
            }
        }
    }, [isOpen, initialData, company, reset, setValue]);
  
    const mode = initialData.launch ? 'edit' : 'create';

    const handleSelectPartner = (partner: Partner) => {
        if (!partnerTarget) return;
        form.setValue(`${partnerTarget}.nome`, partner.razaoSocial);
        form.setValue(`${partnerTarget}.cnpj`, partner.cpfCnpj);
        setPartnerModalOpen(false);
        setPartnerTarget(null);
    };

    const openPartnerSearch = (target: 'prestador' | 'tomador') => {
      setPartnerTarget(target);
      setPartnerModalOpen(true);
    };
    
    const handleServiceTypeChange = (type: 'prestado' | 'tomado') => {
        setServiceType(type);
        // Clear parties and set the company to the correct role
        setValue('prestador', { nome: '', cnpj: '' });
        setValue('tomador', { nome: '', cnpj: '' });
        if (type === 'prestado') {
            setValue('prestador.nome', company.razaoSocial);
            setValue('prestador.cnpj', company.cnpj);
        } else {
            setValue('tomador.nome', company.razaoSocial);
            setValue('tomador.cnpj', company.cnpj);
        }
    }

    const handleParseXmlFromText = () => {
        if (!xmlContent) {
            toast({ variant: 'destructive', title: 'Nenhum XML para analisar.' });
            return;
        }
        try {
            const parsedData = parseXmlForService(xmlContent);
             if ('error' in parsedData) {
                toast({ variant: 'destructive', title: 'Erro ao Analisar XML', description: parsedData.error });
                return;
            }
            Object.keys(parsedData).forEach(key => {
                setValue(key as keyof FormData, (parsedData as any)[key]);
            });
            toast({ title: 'XML analisado com sucesso!', description: 'Os campos do formulário foram preenchidos.' });
        } catch (error) {
            console.error("Error parsing XML from text:", error);
            toast({ variant: 'destructive', title: 'Erro ao analisar XML.' });
        }
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
            } else {
                 delete (dataToSave as any).createdAt;
            }

            const partnerType = serviceType === 'prestado' ? 'cliente' : 'fornecedor';
            const partnerData = serviceType === 'prestado' ? dataToSave.tomador : dataToSave.prestador;

            if (partnerData?.cnpj && partnerData?.nome) {
                await upsertPartnerFromLaunch(userId, company.id, { cpfCnpj: partnerData.cnpj, razaoSocial: partnerData.nome, type: partnerType });
            }
            
            const launchRef = mode === 'create' ? collection(db, `users/${userId}/companies/${company.id}/launches`) : doc(db, `users/${userId}/companies/${company.id}/launches`, initialData.launch!.id);
            if (mode === 'create') {
                await addDoc(launchRef, dataToSave);
                toast({ title: "Lançamento Criado!", description: `A nota foi salva com sucesso.` });
            } else {
                await updateDoc(launchRef as any, dataToSave);
                 toast({ title: "Lançamento Atualizado!", description: `As alterações foram salvas com sucesso.`});
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
        if (mode === 'create') return `Lançamento de Nota Fiscal de Serviço`;
        return `Alterar Lançamento de Serviço`;
    };
    
     const renderPartyField = (partyName: 'prestador' | 'tomador', label: string) => (
        <div className="space-y-4 rounded-md border p-4">
             <h4 className="font-semibold">{label}</h4>
            <FormField control={control} name={`${partyName}.nome`} render={({ field }) => ( <FormItem><FormLabel>Razão Social</FormLabel><div className="flex gap-2"><FormControl><Input {...field} value={field.value || ''}  /></FormControl><Button type="button" variant="outline" size="icon" onClick={() => openPartnerSearch(partyName)}><Search className="h-4 w-4"/></Button></div><FormMessage /></FormItem> )} />
            <FormField control={control} name={`${partyName}.cnpj`} render={({ field }) => ( <FormItem><FormLabel>CNPJ / CPF</FormLabel><FormControl><Input {...field} value={field.value || ''}  /></FormControl><FormMessage /></FormItem> )} />
        </div>
    );

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl w-full">
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
                    <DialogHeader>
                    <DialogTitle>{getTitle()}</DialogTitle>
                    <DialogDescription>
                         Preencha os dados da nota fiscal de serviço.
                    </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4">
                        <RadioGroup defaultValue="prestado" onValueChange={(value: 'prestado' | 'tomado') => handleServiceTypeChange(value)} value={serviceType} className="flex gap-4">
                            <Label className="flex items-center gap-2 border rounded-md p-3 flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/5 cursor-pointer">
                                <RadioGroupItem value="prestado" />
                                <div>
                                    <p className="font-semibold">Serviços Prestados</p>
                                    <p className="text-xs text-muted-foreground">Sua empresa emitiu a nota para um cliente.</p>
                                </div>
                            </Label>
                             <Label className="flex items-center gap-2 border rounded-md p-3 flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/5 cursor-pointer">
                                <RadioGroupItem value="tomado" />
                                <div>
                                    <p className="font-semibold">Serviços Tomados</p>
                                    <p className="text-xs text-muted-foreground">Sua empresa contratou um serviço de um fornecedor.</p>
                                </div>
                            </Label>
                        </RadioGroup>
                    </div>

                     <Tabs defaultValue="geral" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="geral">Geral</TabsTrigger>
                            <TabsTrigger value="parties">Partes</TabsTrigger>
                            <TabsTrigger value="details">Detalhes</TabsTrigger>
                        </TabsList>
                        <div className="py-4 max-h-[50vh] overflow-y-auto pr-4 mt-2">
                             <TabsContent value="geral" className="space-y-4">
                                {mode === 'create' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="xml-content">Conteúdo do XML (Opcional)</Label>
                                        <Textarea id="xml-content" placeholder="Cole o conteúdo do XML da NFS-e aqui..." value={xmlContent} onChange={(e) => setXmlContent(e.target.value)} rows={6} />
                                        <Button type="button" variant="secondary" onClick={handleParseXmlFromText}><Bot className="mr-2 h-4 w-4"/> Analisar XML</Button>
                                    </div>
                                )}
                                <div className="grid grid-cols-3 gap-4">
                                     <FormField control={control} name="numeroNfse" render={({ field }) => ( <FormItem><FormLabel>Número da Nota</FormLabel><FormControl><Input {...field} value={field.value || ''}  /></FormControl></FormItem> )} />
                                    <FormField control={control} name="serie" render={({ field }) => ( <FormItem><FormLabel>Série</FormLabel><FormControl><Input {...field} value={field.value || ''}  /></FormControl></FormItem> )} />
                                    <FormField control={control} name="date" render={({ field }) => (<FormItem><FormLabel>Data de Emissão</FormLabel><FormControl><DateInput value={field.value} onChange={field.onChange}  /></FormControl></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                     <FormField control={control} name="status" render={({ field }) => (<FormItem><FormLabel>Status da Nota</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem><SelectItem value="Substituida">Substituída</SelectItem></SelectContent></Select></FormItem>)} />
                                </div>
                                <Separator className="my-4"/>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                     <FormField control={control} name="valorServicos" render={({ field }) => ( <FormItem><FormLabel>Valor dos Serviços</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     <FormField control={control} name="valorIss" render={({ field }) => ( <FormItem><FormLabel>Valor do ISS</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     <FormField control={control} name="valorIr" render={({ field }) => ( <FormItem><FormLabel>Valor do IR</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     <FormField control={control} name="valorInss" render={({ field }) => ( <FormItem><FormLabel>Valor do INSS</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     <FormField control={control} name="valorPis" render={({ field }) => ( <FormItem><FormLabel>Valor do PIS</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     <FormField control={control} name="valorCofins" render={({ field }) => ( <FormItem><FormLabel>Valor do COFINS</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     <FormField control={control} name="valorCsll" render={({ field }) => ( <FormItem><FormLabel>Valor do CSLL</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0}  /></FormControl></FormItem> )} />
                                     <FormField control={control} name="valorLiquido" render={({ field }) => ( <FormItem><FormLabel>Valor Líquido da Nota</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || 0} readOnly className="font-semibold border-primary" /></FormControl></FormItem> )} />
                                </div>
                            </TabsContent>
                            <TabsContent value="parties" className="space-y-4">
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {renderPartyField('prestador', 'Prestador do Serviço')}
                                    {renderPartyField('tomador', 'Tomador do Serviço')}
                                </div>
                            </TabsContent>
                             <TabsContent value="details" className="space-y-4">
                                <div className="space-y-4">
                                    <FormField control={control} name="discriminacao" render={({ field }) => ( <FormItem><FormLabel>Discriminação dos Serviços</FormLabel><FormControl><Textarea {...field} value={field.value || ''}  rows={10} /></FormControl></FormItem> )} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={control} name="itemLc116" render={({ field }) => ( <FormItem><FormLabel>Item da Lista (LC 116)</FormLabel><FormControl><Input {...field} value={field.value || ''}  /></FormControl></FormItem> )} />
                                        <FormField control={control} name="codigoVerificacaoNfse" render={({ field }) => ( <FormItem><FormLabel>Código de Verificação</FormLabel><FormControl><Input {...field} value={field.value || ''}  /></FormControl></FormItem> )} />
                                    </div>
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
                    partnerType={partnerTarget === 'prestador' ? 'fornecedor' : 'cliente'}
                />
            )}
        </>
    );
};
