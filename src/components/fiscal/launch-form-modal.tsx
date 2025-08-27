
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, PlusCircle, Trash2 } from 'lucide-react';
import { Launch, Company } from '@/app/(app)/fiscal/page';
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
import { FileText } from 'lucide-react';
import { Separator } from '../ui/separator';

interface XmlFile {
  file: File;
  content: string;
  status: 'pending' | 'launched' | 'error' | 'cancelled';
  type: 'entrada' | 'saida' | 'servico' | 'desconhecido' | 'cancelamento';
}

interface LaunchFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  xmlFile: XmlFile | null;
  launch: Launch | null;
  orcamento: Orcamento | null;
  manualLaunchType: 'entrada' | 'saida' | 'servico' | null;
  mode: 'create' | 'edit' | 'view';
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
  type: z.string().default(''),
  status: z.enum(['Normal', 'Cancelado', 'Substituida']),
  date: z.date(),
  observacoes: z.string().optional().nullable(),

  // NF-e & NFS-e fields
  chaveNfe: z.string().optional().nullable(),
  numeroNfse: z.string().optional().nullable(),
  
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
    const nfseNode = xmlDoc.querySelector('CompNfse, NFSe, ConsultarNfseServicoPrestadoResposta');

    let dateString: string | null = null;
    let dateObj: Date | undefined = undefined;

    if (isNFe) {
        const protNode = xmlDoc.querySelector('protNFe infProt');
        const dateSelectors = protNode ? ['dhRecbto'] : ['ide dhEmi', 'dEmi'];
        dateString = querySelectorText(protNode || xmlDoc, dateSelectors);
    } else if (nfseNode) {
        const serviceNode = nfseNode.querySelector('InfNfse') || nfseNode;
        const dateSelectors = ['dCompet', 'DataEmissao', 'dtEmissao'];
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

    const getTax = (selectors: string[]) => parseFloat(querySelectorText(xmlDoc, selectors) || '0');

    if (type === 'servico' && nfseNode) {
        const servicoNode = nfseNode.querySelector('InfNfse') || nfseNode;
        data.numeroNfse = querySelectorText(servicoNode, ['Numero', 'nNFSe']) || '';
        data.valorServicos = getTax(['ValorServicos', 'vServ', 'vlrServicos']);
        data.valorLiquido = getTax(['ValorLiquidoNfse', 'vLiq', 'vNF']);
        data.discriminacao = querySelectorText(servicoNode, ['Discriminacao', 'discriminacao', 'xDescricao', 'xDescServ', 'infCpl']) || '';
        data.itemLc116 = querySelectorText(servicoNode, ['ItemListaServico', 'cServico']) || '';
        data.valorPis = getTax(['ValorPis', 'vPIS']);
        data.valorCofins = getTax(['ValorCofins', 'vCOFINS']);
        data.valorIr = getTax(['ValorIr', 'vIR']);
        data.valorInss = getTax(['ValorInss', 'vINSS']);
        data.valorCsll = getTax(['ValorCsll', 'vCSLL']);
        data.valorIss = getTax(['ValorIssRetido', 'vISSRet', 'ValorIss']);
        data.prestador = { nome: querySelectorText(servicoNode.querySelector('PrestadorServico, Prestador, prest'), ['RazaoSocial', 'Nome', 'xNome']), cnpj: querySelectorText(servicoNode.querySelector('PrestadorServico, Prestador, prest'), ['Cnpj', 'CNPJ', 'CpfCnpj > Cnpj']) };
        data.tomador = { nome: querySelectorText(servicoNode.querySelector('TomadorServico, Tomador, toma'), ['RazaoSocial', 'Nome', 'xNome']), cnpj: querySelectorText(servicoNode.querySelector('TomadorServico, Tomador, toma'), ['IdentificacaoTomador CpfCnpj Cnpj', 'IdentificacaoTomador CpfCnpj Cpf', 'CpfCnpj Cnpj', 'CpfCnpj Cpf', 'CNPJ', 'CPF']) };
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
    prestador: { nome: '', cnpj: '' }, tomador: { nome: '', cnpj: '' },
    discriminacao: '', itemLc116: '', valorServicos: 0, valorLiquido: 0,
    emitente: { nome: '', cnpj: '' }, destinatario: { nome: '', cnpj: '' },
    valorProdutos: 0, valorTotalNota: 0, produtos: [], observacoes: '',
    valorPis: 0, valorCofins: 0, valorCsll: 0, valorIr: 0, valorInss: 0, valorIcms: 0, valorIpi: 0, valorIss: 0,
};

export function LaunchFormModal({ isOpen, onClose, xmlFile, launch, orcamento, manualLaunchType, mode, userId, company, onLaunchSuccess, partners }: LaunchFormModalProps) {
  const [isPartnerModalOpen, setPartnerModalOpen] = useState(false);
  const [partnerTarget, setPartnerTarget] = useState<'emitente' | 'destinatario' | 'prestador' | 'tomador' | null>(null);

  const form = useForm<FormData>({ 
    resolver: zodResolver(launchSchema),
    defaultValues: defaultLaunchValues
  });
  const { control, setValue, getValues } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "produtos",
  });
  
  const watchedFormValues = useWatch({ control });

  // Auto-calculate totals for NF-e
  useEffect(() => {
    if (watchedFormValues.type !== 'servico' && watchedFormValues.produtos) {
      const newTotalProdutos = watchedFormValues.produtos.reduce((acc, p) => acc + (p.valorTotal || 0), 0);
      setValue('valorProdutos', parseFloat(newTotalProdutos.toFixed(2)));
      // Simple total for now. Can be expanded with IPI, etc.
      setValue('valorTotalNota', parseFloat(newTotalProdutos.toFixed(2)));
    }
  }, [watchedFormValues.produtos, watchedFormValues.type, setValue]);

  // Auto-calculate net value for NFS-e
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

  const isReadOnly = mode === 'view';
  const modalKey = launch?.id || xmlFile?.file.name || (manualLaunchType ? `manual-${manualLaunchType}` : 'new');


  const formatCnpj = (cnpj?: string | null) => {
    if (!cnpj) return '';
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length === 11) return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    if (cleaned.length !== 14) return cnpj;
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  useEffect(() => {
    if (isOpen) {
      let initialData: Partial<FormData> = {};
      if (mode === 'create') {
        if (xmlFile) {
          initialData = parseXmlAdvanced(xmlFile.content, xmlFile.type as any);
          initialData.type = xmlFile.type;
          initialData.fileName = xmlFile.file.name;
          initialData.status = xmlFile.status === 'cancelled' ? 'Cancelado' : 'Normal';
        } else if (manualLaunchType) {
          initialData = { type: manualLaunchType, date: new Date(), fileName: 'Lançamento Manual', status: 'Normal' };
          if (manualLaunchType === 'servico') initialData.prestador = { nome: company.razaoSocial, cnpj: company.cnpj };
          else if (manualLaunchType === 'saida') initialData.emitente = { nome: company.razaoSocial, cnpj: company.cnpj };
          else if (manualLaunchType === 'entrada') initialData.destinatario = { nome: company.razaoSocial, cnpj: company.cnpj };
        } else if (orcamento) {
            const hasServices = orcamento.items.some(i => i.type === 'servico');
            const type = hasServices ? 'servico' : 'saida';
            initialData = { type, date: new Date(), fileName: `Orçamento ${String(orcamento.quoteNumber).padStart(4, '0')}`, status: 'Normal',
                discriminacao: orcamento.items.map(i => `${i.quantity}x ${i.description}`).join('; '),
                valorServicos: orcamento.total, valorTotalNota: orcamento.total, valorLiquido: orcamento.total,
                produtos: orcamento.items.filter(i => i.type === 'produto').map(p => ({ codigo: p.id, descricao: p.description, valorUnitario: p.unitPrice, ncm: '', cfop: '', quantidade: p.quantity, valorTotal: p.total }))
            };
            if(type === 'servico') initialData.prestador = { nome: company.razaoSocial, cnpj: company.cnpj };
            else initialData.emitente = { nome: company.razaoSocial, cnpj: company.cnpj };
        }
      } else if (mode === 'edit' || mode === 'view') {
        initialData = { ...launch };
      }
      form.reset({ ...defaultLaunchValues, ...initialData });
    }
  }, [isOpen, xmlFile, launch, orcamento, manualLaunchType, mode, company.razaoSocial, company.cnpj, form]);


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
    try {
        const dataToSave = { ...values,
            emitente: values.emitente ? { nome: values.emitente.nome || null, cnpj: values.emitente.cnpj?.replace(/\D/g, '') || null } : null,
            destinatario: values.destinatario ? { nome: values.destinatario.nome || null, cnpj: values.destinatario.cnpj?.replace(/\D/g, '') || null } : null,
            prestador: values.prestador ? { nome: values.prestador.nome || null, cnpj: values.prestador.cnpj?.replace(/\D/g, '') || null } : null,
            tomador: values.tomador ? { nome: values.tomador.nome || null, cnpj: values.tomador.cnpj?.replace(/\D/g, '') || null } : null,
        };
        if (values.produtos && values.produtos.length > 0) await upsertProductsFromLaunch(userId, company.id, values.produtos as Produto[]);
        const partnerType = dataToSave.type === 'entrada' ? 'fornecedor' : 'cliente';
        const partnerData = dataToSave.type === 'entrada' ? dataToSave.emitente : (dataToSave.destinatario || dataToSave.tomador);
        if (partnerData?.cnpj && partnerData?.nome) await upsertPartnerFromLaunch(userId, company.id, { cpfCnpj: partnerData.cnpj, razaoSocial: partnerData.nome, type: partnerType });
        const launchRef = mode === 'create' ? collection(db, `users/${userId}/companies/${company.id}/launches`) : doc(db, `users/${userId}/companies/${company.id}/launches`, launch!.id);
        if (mode === 'create') {
            await addDoc(launchRef, dataToSave);
            onLaunchSuccess(dataToSave.chaveNfe || dataToSave.numeroNfse || '', dataToSave.status);
        } else {
            await updateDoc(launchRef as any, dataToSave);
            onClose();
        }
    } catch (error) { console.error(error); }
  };
  
  const getTitle = () => {
    if(orcamento) return `Lançamento do Orçamento ${String(orcamento.quoteNumber).padStart(4, '0')}`;
    if (mode === 'create') return xmlFile ? 'Confirmar Lançamento de XML' : `Novo Lançamento Manual`;
    return mode === 'edit' ? 'Alterar Lançamento Fiscal' : 'Visualizar Lançamento Fiscal';
  };

  const renderPartyField = (partyName: 'emitente' | 'destinatario' | 'prestador' | 'tomador', label: string) => (
    <AccordionItem value={partyName}>
        <AccordionTrigger>{label}</AccordionTrigger>
        <AccordionContent className="space-y-4 px-1">
             <div className="space-y-2">
                <FormLabel>Razão Social</FormLabel>
                <div className="flex gap-2">
                    <FormControl>
                        <Input {...form.register(`${partyName}.nome`)} readOnly={isReadOnly} />
                    </FormControl>
                    <Button type="button" variant="outline" size="icon" onClick={() => openPartnerSearch(partyName)} disabled={isReadOnly}><Search className="h-4 w-4"/></Button>
                </div>
            </div>
            <div className="space-y-2">
                <FormLabel>CNPJ / CPF</FormLabel>
                <FormControl><Input {...form.register(`${partyName}.cnpj`)} value={formatCnpj(form.watch(`${partyName}.cnpj`))} onChange={(e) => form.setValue(`${partyName}.cnpj`, e.target.value)} readOnly={isReadOnly} /></FormControl>
            </div>
        </AccordionContent>
    </AccordionItem>
  );

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl" key={modalKey}>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
           <DialogDescription asChild>
            <div>
              <div className="flex items-center gap-2"><span>Tipo:</span><Badge variant="secondary" className="text-base capitalize">{form.getValues('type')}</Badge></div>
              {(xmlFile || orcamento || launch?.fileName) && <p className="flex items-center gap-1.5 text-sm mt-1 text-muted-foreground"><FileText className="h-3.5 w-3.5" /><span>{form.getValues('fileName')}</span></p>}
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[70vh] overflow-y-auto pr-4">
          <Accordion type="multiple" defaultValue={['general', 'emitter', 'recipient', 'products', 'service', 'taxes']} className="w-full">
              <AccordionItem value="general">
                  <AccordionTrigger>Informações Gerais</AccordionTrigger>
                  <AccordionContent className="space-y-4 px-1">
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="numeroNfse" render={({ field }) => ( <FormItem><FormLabel>Número da Nota</FormLabel><FormControl><Input {...field} readOnly={isReadOnly || !!xmlFile} /></FormControl></FormItem> )} />
                          <FormField control={form.control} name="chaveNfe" render={({ field }) => ( <FormItem><FormLabel>Chave de Acesso</FormLabel><FormControl><Input {...field} readOnly={isReadOnly || !!xmlFile} /></FormControl></FormItem> )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="date" render={({ field }) => (<FormItem><FormLabel>Data de Emissão/Competência</FormLabel><FormControl><Input type="date" value={isValid(new Date(field.value)) ? format(new Date(field.value), 'yyyy-MM-dd') : ''} onChange={(e) => field.onChange(new Date(e.target.value + 'T00:00:00'))} readOnly={isReadOnly} /></FormControl></FormItem>)} />
                          <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status da Nota Fiscal</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem><SelectItem value="Substituida">Substituída</SelectItem></SelectContent></Select></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="observacoes" render={({ field }) => ( <FormItem><FormLabel>Observações Internas</FormLabel><FormControl><Textarea {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                  </AccordionContent>
              </AccordionItem>

              {form.getValues('type') === 'servico' ? (
                <>
                  {renderPartyField('prestador', 'Prestador do Serviço')}
                  {renderPartyField('tomador', 'Tomador do Serviço')}
                </>
              ) : (
                <>
                  {renderPartyField('emitente', 'Emitente')}
                  {renderPartyField('destinatario', 'Destinatário')}
                </>
              )}

              {form.getValues('type') === 'servico' ? (
                 <AccordionItem value="service">
                    <AccordionTrigger>Serviços e Valores</AccordionTrigger>
                    <AccordionContent className="space-y-4 px-1">
                        <FormField control={form.control} name="discriminacao" render={({ field }) => ( <FormItem><FormLabel>Discriminação do Serviço</FormLabel><FormControl><Textarea {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        <div className="grid grid-cols-3 gap-4">
                            <FormField control={form.control} name="itemLc116" render={({ field }) => ( <FormItem><FormLabel>Item LC 116</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="valorServicos" render={({ field }) => ( <FormItem><FormLabel>Valor dos Serviços</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                             <FormField control={form.control} name="valorLiquido" render={({ field }) => ( <FormItem><FormLabel>Valor Líquido</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly className="font-semibold" /></FormControl></FormItem> )} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
              ) : (
                 <AccordionItem value="products">
                    <AccordionTrigger>Produtos e Valores</AccordionTrigger>
                    <AccordionContent className="space-y-4 px-1">
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
                            <FormField control={form.control} name="valorProdutos" render={({ field }) => ( <FormItem><FormLabel>Valor Total dos Produtos</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="valorTotalNota" render={({ field }) => ( <FormItem><FormLabel>Valor Total da Nota</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly /></FormControl></FormItem> )} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
              )}
               <AccordionItem value="taxes">
                    <AccordionTrigger>Impostos</AccordionTrigger>
                    <AccordionContent className="grid grid-cols-2 md:grid-cols-4 gap-4 px-1">
                        <FormField control={form.control} name="valorPis" render={({ field }) => ( <FormItem><FormLabel>PIS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="valorCofins" render={({ field }) => ( <FormItem><FormLabel>COFINS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="valorCsll" render={({ field }) => ( <FormItem><FormLabel>CSLL</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="valorIr" render={({ field }) => ( <FormItem><FormLabel>IR</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="valorInss" render={({ field }) => ( <FormItem><FormLabel>INSS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        {form.getValues('type') === 'servico' ? (
                          <FormField control={form.control} name="valorIss" render={({ field }) => ( <FormItem><FormLabel>ISS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        ) : (
                          <>
                           <FormField control={form.control} name="valorIcms" render={({ field }) => ( <FormItem><FormLabel>ICMS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                           <FormField control={form.control} name="valorIpi" render={({ field }) => ( <FormItem><FormLabel>IPI</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                          </>
                        )}
                    </AccordionContent>
                </AccordionItem>
          </Accordion>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>{mode === 'view' ? 'Fechar' : 'Cancelar'}</Button>
          {mode !== 'view' && <Button type="submit">{mode === 'create' ? 'Confirmar Lançamento' : 'Salvar Alterações'}</Button>}
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
}
