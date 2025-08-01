

"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search } from 'lucide-react';
import { Launch, Company } from '@/app/(app)/fiscal/page';
import { parse, format, isValid } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Textarea } from '../ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { Produto } from '@/types/produto';
import { upsertProductsFromLaunch } from '@/services/product-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PartnerSelectionModal } from '../parceiros/partner-selection-modal';
import type { Partner } from '@/types/partner';
import { upsertPartnerFromLaunch } from '@/services/partner-service';
import type { Orcamento } from '@/types/orcamento';


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
}

const partySchema = z.object({
  nome: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
}).optional().nullable();

const productSchema = z.object({
    codigo: z.string(),
    descricao: z.string(),
    ncm: z.string(),
    cfop: z.string(),
    valorUnitario: z.number(),
}).partial();

const launchSchema = z.object({
  fileName: z.string(),
  type: z.string(),
  status: z.enum(['Normal', 'Cancelado', 'Substituida']),
  date: z.date(),
  chaveNfe: z.string().optional().nullable(),
  numeroNfse: z.string().optional().nullable(),
  prestador: partySchema,
  tomador: partySchema,
  discriminacao: z.string().optional().nullable(),
  itemLc116: z.string().optional().nullable(),
  valorServicos: z.number().optional().nullable(),
  valorPis: z.number().optional().nullable(),
  valorCofins: z.number().optional().nullable(),
  valorIr: z.number().optional().nullable(),
  valorInss: z.number().optional().nullable(),
  valorCsll: z.number().optional().nullable(),
  valorLiquido: z.number().optional().nullable(),
  emitente: partySchema,
  destinatario: partySchema,
  valorProdutos: z.number().optional().nullable(),
  valorTotalNota: z.number().optional().nullable(),
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
    const isNfsePadrao = xmlDoc.querySelector('CompNfse, NFSe');
    const isNfseAbrasf = xmlDoc.querySelector('ConsultarNfseServicoPrestadoResposta, CompNfse');

    if (type === 'servico' && (isNfsePadrao || isNfseAbrasf)) {
        const nfseNode = isNfseAbrasf ? xmlDoc.querySelector('InfNfse') : isNfsePadrao;
        if (!nfseNode) return {};
        
        // Prioritize dCompet for service notes
        const dateString = querySelectorText(nfseNode, ['dCompet', 'DataEmissao', 'dtEmissao']);
        data.date = new Date(dateString);

        data.numeroNfse = querySelectorText(nfseNode, ['Numero', 'nNFSe']);
        data.valorServicos = parseFloat(querySelectorText(nfseNode, ['ValorServicos', 'vServ', 'vlrServicos']) || '0');
        data.valorLiquido = parseFloat(querySelectorText(nfseNode, ['ValorLiquidoNfse', 'vLiq', 'vNF']) || '0');
        data.discriminacao = querySelectorText(nfseNode, ['Discriminacao', 'discriminacao', 'xDescricao', 'xDescServ', 'infCpl']);
        
        let itemLc = querySelectorText(nfseNode, ['ItemListaServico', 'cServico']);
        if (!itemLc) {
            const cTribNac = querySelectorText(nfseNode, ['cTribNac']);
            if (cTribNac) {
                itemLc = cTribNac.substring(0, 4);
            }
        }
        data.itemLc116 = itemLc;
        
        data.valorPis = parseFloat(querySelectorText(nfseNode, ['ValorPis', 'vPIS']) || '0');
        data.valorCofins = parseFloat(querySelectorText(nfseNode, ['ValorCofins', 'vCOFINS']) || '0');
        data.valorIr = parseFloat(querySelectorText(nfseNode, ['ValorIr', 'vIR']) || '0');
        data.valorInss = parseFloat(querySelectorText(nfseNode, ['ValorInss', 'vINSS']) || '0');
        data.valorCsll = parseFloat(querySelectorText(nfseNode, ['ValorCsll', 'vCSLL']) || '0');

        const prestadorNode = nfseNode.querySelector('PrestadorServico, Prestador, prest');
        if (prestadorNode) {
            data.prestador = {
                nome: querySelectorText(prestadorNode, ['RazaoSocial', 'Nome', 'xNome']),
                cnpj: querySelectorText(prestadorNode, ['Cnpj', 'CNPJ', 'CpfCnpj > Cnpj'])
            };
        }

        const tomadorNode = nfseNode.querySelector('TomadorServico, Tomador, toma');
        if (tomadorNode) {
            data.tomador = {
                nome: querySelectorText(tomadorNode, ['RazaoSocial', 'Nome', 'xNome']),
                cnpj: querySelectorText(tomadorNode, ['IdentificacaoTomador CpfCnpj Cnpj', 'IdentificacaoTomador CpfCnpj Cpf', 'CpfCnpj Cnpj', 'CpfCnpj Cpf', 'CNPJ', 'CPF'])
            };
        }
        
    } else if (isNFe) {
        const emitNode = xmlDoc.querySelector('emit');
        const destNode = xmlDoc.querySelector('dest');
        
        if (emitNode) {
            data.emitente = {
                nome: querySelectorText(emitNode, ['xNome']),
                cnpj: querySelectorText(emitNode, ['CNPJ', 'CPF'])
            };
        }
        if (destNode) {
            data.destinatario = {
                nome: querySelectorText(destNode, ['xNome']),
                cnpj: querySelectorText(destNode, ['CNPJ', 'CPF'])
            };
        }
        
        const infNFeNode = xmlDoc.querySelector('infNFe');
        let chave = infNFeNode ? infNFeNode.getAttribute('Id') || '' : '';
        if (!chave) chave = querySelectorText(xmlDoc, ['chNFe']);
        data.chaveNfe = chave.replace(/\D/g, '');
        
        // Prioritize dhProc (protocol date) for merchandise notes
        const dateString = querySelectorText(infNFeNode, ['dhProc', 'dhEmi', 'dEmi']);
        data.date = new Date(dateString);
        
        data.valorProdutos = parseFloat(querySelectorText(xmlDoc, ['vProd']) || '0');
        data.valorTotalNota = parseFloat(querySelectorText(xmlDoc, ['vNF']) || '0');

        data.produtos = Array.from(xmlDoc.querySelectorAll('det')).map(det => {
            const prodNode = det.querySelector('prod');
            if (!prodNode) return {};
            return {
                codigo: querySelectorText(prodNode, ['cProd']),
                descricao: querySelectorText(prodNode, ['xProd']),
                ncm: querySelectorText(prodNode, ['NCM']),
                cfop: querySelectorText(prodNode, ['CFOP']),
                valorUnitario: parseFloat(querySelectorText(prodNode, ['vUnCom']) || '0'),
            };
        }).filter(p => p.codigo);
    }
    
    return data;
}

export function LaunchFormModal({ isOpen, onClose, xmlFile, launch, orcamento, manualLaunchType, mode, userId, company, onLaunchSuccess }: LaunchFormModalProps) {
  const [isPartnerModalOpen, setPartnerModalOpen] = useState(false);
  const [partnerTarget, setPartnerTarget] = useState<'emitente' | 'destinatario' | 'prestador' | 'tomador' | null>(null);

  const form = useForm<FormData>({ resolver: zodResolver(launchSchema) });
  const isReadOnly = mode === 'view';

  const formatCnpj = (cnpj?: string) => {
    if (!cnpj) return '';
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length === 11) {
       return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    }
    if (cleaned.length !== 14) return cnpj;
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  useEffect(() => {
    if (isOpen) {
      let initialData: Partial<FormData> = {};
      if (mode === 'create') {
        if (xmlFile) {
          initialData = parseXmlAdvanced(xmlFile.content, xmlFile.type);
          initialData.type = xmlFile.type;
          initialData.fileName = xmlFile.file.name;
          initialData.status = xmlFile.status === 'cancelled' ? 'Cancelado' : 'Normal';
        } else if (manualLaunchType) {
          initialData = { type: manualLaunchType, date: new Date(), fileName: 'Lançamento Manual', status: 'Normal' };
          if (manualLaunchType === 'servico') {
            initialData.prestador = { nome: company.razaoSocial, cnpj: company.cnpj };
          } else if (manualLaunchType === 'saida') {
             initialData.emitente = { nome: company.razaoSocial, cnpj: company.cnpj };
          } else if (manualLaunchType === 'entrada') {
             initialData.destinatario = { nome: company.razaoSocial, cnpj: company.cnpj };
          }
        } else if (orcamento) {
            const hasServices = orcamento.items.some(i => i.type === 'servico');
            const hasProducts = orcamento.items.some(i => i.type === 'produto');
            const type = hasServices ? 'servico' : 'saida';

            initialData = {
                type: type,
                date: new Date(),
                fileName: `Orçamento ${String(orcamento.quoteNumber).padStart(4, '0')}`,
                status: 'Normal',
                discriminacao: orcamento.items.map(i => `${i.quantity}x ${i.description}`).join('; '),
                valorServicos: orcamento.total,
                valorTotalNota: orcamento.total,
                valorLiquido: orcamento.total,
                produtos: hasProducts ? orcamento.items.filter(i => i.type === 'produto').map(p => ({
                    codigo: p.id,
                    descricao: p.description,
                    valorUnitario: p.unitPrice,
                    ncm: '', // NCM should be in product catalog
                    cfop: '', // CFOP should be in product catalog
                })) : [],
            };
            if(type === 'servico') {
                initialData.prestador = { nome: company.razaoSocial, cnpj: company.cnpj };
            } else {
                 initialData.emitente = { nome: company.razaoSocial, cnpj: company.cnpj };
            }
        }
      } else if (mode === 'edit' || mode === 'view') {
        initialData = { ...launch };
      }
      form.reset(initialData);
    }
  }, [isOpen, xmlFile, launch, manualLaunchType, orcamento, mode, company, form]);

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
  }

  const handleSubmit = async (values: FormData) => {
    if (mode === 'view') { onClose(); return; }

    try {
        const dataToSave = {
            ...values,
            emitente: values.emitente ? { nome: values.emitente.nome || null, cnpj: values.emitente.cnpj?.replace(/\D/g, '') || null } : null,
            destinatario: values.destinatario ? { nome: values.destinatario.nome || null, cnpj: values.destinatario.cnpj?.replace(/\D/g, '') || null } : null,
            prestador: values.prestador ? { nome: values.prestador.nome || null, cnpj: values.prestador.cnpj?.replace(/\D/g, '') || null } : null,
            tomador: values.tomador ? { nome: values.tomador.nome || null, cnpj: values.tomador.cnpj?.replace(/\D/g, '') || null } : null,
        };
        
        // Upsert products if present
        if (values.produtos && values.produtos.length > 0) {
            await upsertProductsFromLaunch(userId, company.id, values.produtos as Produto[]);
        }
        
        const partnerType = dataToSave.type === 'entrada' ? 'fornecedor' : 'cliente';
        const partnerData = dataToSave.type === 'entrada' ? dataToSave.emitente : (dataToSave.destinatario || dataToSave.tomador);
        
        if (partnerData?.cnpj && partnerData?.nome) {
            await upsertPartnerFromLaunch(userId, company.id, {
                cpfCnpj: partnerData.cnpj,
                razaoSocial: partnerData.nome,
                type: partnerType,
            });
        }
        
        const launchRef = mode === 'create'
            ? collection(db, `users/${userId}/companies/${company.id}/launches`)
            : doc(db, `users/${userId}/companies/${company.id}/launches`, launch!.id);

        if (mode === 'create') {
            await addDoc(launchRef, dataToSave);
            const launchKey = dataToSave.chaveNfe || dataToSave.numeroNfse || '';
            onLaunchSuccess(launchKey, dataToSave.status);
        } else {
            await updateDoc(launchRef as any, dataToSave);
            onClose();
        }

    } catch (error) {
        console.error(error);
    }
  };
  
  const getTitle = () => {
    if(orcamento) return `Lançamento do Orçamento ${String(orcamento.quoteNumber).padStart(4, '0')}`;
    if (mode === 'create') return xmlFile ? 'Confirmar Lançamento de XML' : `Novo Lançamento Manual`;
    return mode === 'edit' ? 'Alterar Lançamento Fiscal' : 'Visualizar Lançamento Fiscal';
  }

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
                    <Button type="button" variant="outline" size="icon" onClick={() => openPartnerSearch(partyName)} disabled={isReadOnly}>
                        <Search className="h-4 w-4"/>
                    </Button>
                </div>
            </div>
            <div className="space-y-2">
                <FormLabel>CNPJ / CPF</FormLabel>
                <FormControl>
                     <Input
                        {...form.register(`${partyName}.cnpj`)}
                        readOnly={isReadOnly}
                        onChange={(e) => {
                            form.setValue(`${partyName}.cnpj`, formatCnpj(e.target.value));
                        }}
                     />
                </FormControl>
            </div>
        </AccordionContent>
    </AccordionItem>
  );

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
           <DialogDescription asChild>
            <div>
              <div className="flex items-center gap-2">
                  <span>Tipo:</span>
                  <Badge variant="secondary" className="text-base capitalize">{form.getValues('type')}</Badge>
              </div>
              {(xmlFile || orcamento) && <p>Arquivo: <span className="font-semibold">{form.getValues('fileName')}</span></p>}
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[70vh] overflow-y-auto pr-4">
          {form.getValues('type') === 'servico' ? (
            <Accordion type="multiple" defaultValue={['general', 'service', 'prestador', 'tomador']} className="w-full">
                <AccordionItem value="general">
                    <AccordionTrigger>Informações Gerais</AccordionTrigger>
                    <AccordionContent className="space-y-4 px-1">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="numeroNfse" render={({ field }) => ( <FormItem><FormLabel>Número da NFS-e</FormLabel><FormControl><Input {...field} readOnly={isReadOnly || !!xmlFile} /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="date" render={({ field }) => ( <FormItem><FormLabel>Data</FormLabel><FormControl><Input type="date" value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''} onChange={e => field.onChange(new Date(e.target.value))} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        </div>
                        <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status da Nota Fiscal</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem><SelectItem value="Substituida">Substituída</SelectItem></SelectContent></Select></FormItem>)} />
                    </AccordionContent>
                </AccordionItem>
                {renderPartyField('prestador', 'Prestador do Serviço')}
                {renderPartyField('tomador', 'Tomador do Serviço')}
                <AccordionItem value="service">
                    <AccordionTrigger>Serviços e Impostos</AccordionTrigger>
                    <AccordionContent className="space-y-4 px-1">
                        <FormField control={form.control} name="discriminacao" render={({ field }) => ( <FormItem><FormLabel>Discriminação do Serviço</FormLabel><FormControl><Textarea {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="itemLc116" render={({ field }) => ( <FormItem><FormLabel>Item LC 116</FormLabel><FormControl><Input {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="valorServicos" render={({ field }) => ( <FormItem><FormLabel>Valor dos Serviços</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <FormField control={form.control} name="valorPis" render={({ field }) => ( <FormItem><FormLabel>PIS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="valorCofins" render={({ field }) => ( <FormItem><FormLabel>COFINS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="valorCsll" render={({ field }) => ( <FormItem><FormLabel>CSLL</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <FormField control={form.control} name="valorInss" render={({ field }) => ( <FormItem><FormLabel>INSS</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="valorIr" render={({ field }) => ( <FormItem><FormLabel>IR</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="valorLiquido" render={({ field }) => ( <FormItem><FormLabel>Valor Líquido</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
          ) : (
             <Accordion type="multiple" defaultValue={['general', 'emitter', 'recipient', 'products']} className="w-full">
                <AccordionItem value="general">
                    <AccordionTrigger>Informações Gerais</AccordionTrigger>
                    <AccordionContent className="space-y-4 px-1">
                        <FormField control={form.control} name="chaveNfe" render={({ field }) => ( <FormItem><FormLabel>Chave da NF-e</FormLabel><FormControl><Input {...field} readOnly={isReadOnly || !!xmlFile} /></FormControl></FormItem> )} />
                        <div className="grid grid-cols-2 gap-4">
                             <FormField control={form.control} name="date" render={({ field }) => ( <FormItem><FormLabel>Data</FormLabel><FormControl><Input type="date" value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''} onChange={e => field.onChange(new Date(e.target.value))} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                             <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status da Nota Fiscal</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem><SelectItem value="Substituida">Substituída</SelectItem></SelectContent></Select></FormItem>)} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
                {renderPartyField('emitente', 'Emitente')}
                {renderPartyField('destinatario', 'Destinatário')}
                <AccordionItem value="products">
                    <AccordionTrigger>Produtos e Valores</AccordionTrigger>
                    <AccordionContent className="space-y-4 px-1">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="valorProdutos" render={({ field }) => ( <FormItem><FormLabel>Valor dos Produtos</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="valorTotalNota" render={({ field }) => ( <FormItem><FormLabel>Valor Total da Nota</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly={isReadOnly} /></FormControl></FormItem> )} />
                        </div>
                        {form.getValues('produtos') && form.getValues('produtos').length > 0 && (
                            <div className="mt-4 space-y-2">
                                <h4 className="font-semibold text-sm">Itens do XML</h4>
                                <div className="border rounded-md max-h-48 overflow-y-auto">
                                    {form.getValues('produtos').map((p, i) => (
                                        <div key={i} className="text-xs p-2 border-b last:border-b-0">
                                            <p className="font-medium truncate">{p.codigo} - {p.descricao}</p>
                                            <p className="text-muted-foreground">NCM: {p.ncm} | CFOP: {p.cfop} | V. Unit: {new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(p.valorUnitario || 0)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
          )}
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
            userId={userId}
            companyId={company.id}
            partnerType={partnerTarget === 'emitente' ? 'fornecedor' : 'cliente'}
        />
    )}
    </>
  );
}
