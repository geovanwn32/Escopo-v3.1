
"use client";

import { useState, useEffect, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Launch, Company } from '@/app/(app)/fiscal/page';
import { parse, format, isValid } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Textarea } from '../ui/textarea';
import { Badge } from '@/components/ui/badge';

interface XmlFile {
  file: File;
  content: string;
  status: 'pending' | 'launched' | 'error';
  type: 'entrada' | 'saida' | 'servico' | 'desconhecido';
}

interface LaunchFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  xmlFile: XmlFile | null;
  launch: Launch | null;
  manualLaunchType: 'entrada' | 'saida' | 'servico' | null;
  mode: 'create' | 'edit' | 'view';
  userId: string;
  company: Company;
  onLaunchSuccess: (fileName: string) => void;
}

const partySchema = z.object({
  nome: z.string().optional(),
  cnpj: z.string().optional(),
}).optional();

const launchSchema = z.object({
  fileName: z.string(),
  type: z.string(),
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
});

type FormData = z.infer<typeof launchSchema>;


function parseXml(xmlString: string): Partial<FormData> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
        console.error("Error parsing XML:", errorNode.textContent);
        return {};
    }

    const get = (selectors: string[], parentNode?: Element | null): string => {
        const parent = parentNode || xmlDoc;
        for (const selector of selectors) {
            const element = parent.querySelector(selector);
            if (element?.textContent) {
                return element.textContent.trim();
            }
        }
        return '';
    };

    const getFloat = (selectors: string[], parentNode?: Element | null): number => {
      const textValue = get(selectors, parentNode);
      return parseFloat(textValue || '0');
    }

    let data: Partial<FormData> = {};

    const infNFe = xmlDoc.querySelector('infNFe');
    const infNfse = xmlDoc.querySelector('InfNfse, infNfse');

    if (infNFe) { // It's an NF-e
        const emit = infNFe.querySelector('emit');
        const dest = infNFe.querySelector('dest');
        const total = infNFe.querySelector('total ICMSTot');
        
        data.chaveNfe = infNFe.getAttribute('Id')?.replace('NFe', '') || 'Chave não encontrada';
        const dateStr = get(['dhEmi'], infNFe);
        if (dateStr) data.date = new Date(dateStr);

        data.emitente = {
            nome: get(['xNome'], emit),
            cnpj: get(['CNPJ'], emit),
        };
        data.destinatario = {
            nome: get(['xNome'], dest),
            cnpj: get(['CNPJ'], dest),
        };
        data.valorProdutos = getFloat(['vProd'], total);
        data.valorTotalNota = getFloat(['vNF'], total);

    } else if (infNfse) { // It's an NFS-e
        const prestadorNode = xmlDoc.querySelector('PrestadorServico, prest');
        const tomadorNode = xmlDoc.querySelector('TomadorServico, toma');
        const servicoNode = xmlDoc.querySelector('Servico, serv');
        const valoresNode = xmlDoc.querySelector('Valores, ValoresNfse, Valor');

        data.numeroNfse = get(['Numero', 'nNFSe'], infNfse);
        const dateStr = get(['DataEmissao', 'dCompet', 'dtEmissao'], infNfse);
        if (dateStr) data.date = new Date(dateStr);
        
        data.prestador = {
            nome: get(['RazaoSocial', 'xNome'], prestadorNode),
            cnpj: get(['Cnpj', 'CNPJ'], prestadorNode),
        };
        data.tomador = {
            nome: get(['RazaoSocial', 'xNome'], tomadorNode),
            cnpj: get(['Cnpj', 'CNPJ'], tomadorNode),
        };

        data.discriminacao = get(['Discriminacao', 'discriminacao', 'xDescricao'], servicoNode);
        data.itemLc116 = get(['ItemListaServico', 'cServico'], servicoNode);
        data.valorServicos = getFloat(['ValorServicos', 'vServ'], valoresNode);
        data.valorPis = getFloat(['ValorPis', 'vPIS'], valoresNode);
        data.valorCofins = getFloat(['ValorCofins', 'vCOFINS'], valoresNode);
        data.valorIr = getFloat(['ValorIr', 'vIR'], valoresNode);
        data.valorInss = getFloat(['ValorInss', 'vINSS'], valoresNode);
        data.valorCsll = getFloat(['ValorCsll', 'vCSLL'], valoresNode);
        data.valorLiquido = getFloat(['ValorLiquidoNfse', 'vLiq'], valoresNode);
    }
    return data;
}

export function LaunchFormModal({ isOpen, onClose, xmlFile, launch, manualLaunchType, mode, userId, company, onLaunchSuccess }: LaunchFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<FormData>>({});
  const { toast } = useToast();
  const isReadOnly = mode === 'view';

  const formatCnpj = (cnpj?: string) => {
    if (!cnpj) return '';
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  const parseCurrency = (value: string): number => {
    const number = parseFloat(value.replace(/[^0-9,]/g, '').replace(',', '.'));
    return isNaN(number) ? 0 : number;
  };

  const formatDate = (date?: Date): string => {
    if (!date || !isValid(date)) return '';
    return format(date, 'yyyy-MM-dd');
  };
  
  const parseDate = (dateStr: string): Date | null => {
    const parsed = new Date(dateStr);
    return isValid(parsed) ? parsed : null;
  };

  useEffect(() => {
    let initialData: Partial<FormData> = {};
    if (isOpen) {
      if (mode === 'create') {
        if (xmlFile) {
          initialData = parseXml(xmlFile.content);
          initialData.type = xmlFile.type;
          initialData.fileName = xmlFile.file.name;
        } else if (manualLaunchType) {
          initialData = {
            type: manualLaunchType,
            date: new Date(),
            fileName: 'Lançamento Manual',
          };
          // Pre-fill company data for manual launches
          if (manualLaunchType === 'servico') {
            initialData.prestador = { nome: company.razaoSocial, cnpj: company.cnpj };
          } else if (manualLaunchType === 'saida') {
             initialData.emitente = { nome: company.razaoSocial, cnpj: company.cnpj };
          } else if (manualLaunchType === 'entrada') {
             initialData.destinatario = { nome: company.razaoSocial, cnpj: company.cnpj };
          }
        }
      } else if ((mode === 'edit' || mode === 'view') && launch) {
        initialData = { ...launch };
      }
      setFormData(initialData);
    }
  }, [isOpen, xmlFile, launch, manualLaunchType, mode, company]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const [section, field] = name.split('.');

    if (field) { // Nested field like prestador.cnpj
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...(prev[section as keyof typeof prev] as object || {}),
          [field]: value
        }
      }));
    } else { // Top-level field
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

 const handleNumericInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numberValue = parseCurrency(value);
    setFormData(prev => ({ ...prev, [name]: isNaN(numberValue) ? undefined : numberValue }));
 };

 const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const date = parseDate(value);
    if(date) {
        setFormData(prev => ({ ...prev, [name]: date }));
    }
 };


  const handleSubmit = async () => {
    if (mode === 'view') {
        onClose();
        return;
    }
    setLoading(true);
    try {
        const dataToSave = {
          ...formData,
          date: formData.date || new Date(),
          fileName: formData.fileName || 'Lançamento Manual',
          type: formData.type || 'desconhecido',
        };

        // Convert undefined to null before saving
        Object.keys(dataToSave).forEach(key => {
            const typedKey = key as keyof typeof dataToSave;
            if (dataToSave[typedKey] === undefined) {
                (dataToSave as any)[typedKey] = null;
            }
            if (typeof dataToSave[typedKey] === 'object' && dataToSave[typedKey] !== null) {
              const nestedObj = dataToSave[typedKey] as any;
              Object.keys(nestedObj).forEach(nestedKey => {
                if(nestedObj[nestedKey] === undefined) {
                  nestedObj[nestedKey] = null;
                }
              });
            }
        });
        
        await launchSchema.parseAsync(dataToSave);

        if (mode === 'create') {
            const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
            await addDoc(launchesRef, dataToSave);
            toast({
                title: "Lançamento realizado!",
                description: dataToSave.fileName === 'Lançamento Manual' 
                    ? `Lançamento manual de ${dataToSave.type} criado.`
                    : `O arquivo ${dataToSave.fileName} foi lançado com sucesso.`
            });
            onLaunchSuccess(dataToSave.fileName);
        } else if (mode === 'edit' && launch) {
            const launchRef = doc(db, `users/${userId}/companies/${company.id}/launches`, launch.id);
            await updateDoc(launchRef, dataToSave);
            toast({
                title: "Lançamento atualizado!",
                description: "As alterações foram salvas com sucesso."
            });
            onClose();
        }

    } catch (error) {
        if (error instanceof z.ZodError) {
            const firstError = error.errors[0];
            toast({
                variant: 'destructive',
                title: `Erro de validação: ${firstError.path.join('.')}`,
                description: firstError.message,
            });
        } else {
            console.error(error);
            toast({
                variant: 'destructive',
                title: "Erro ao Salvar",
                description: "Ocorreu um erro ao salvar os dados. Verifique o console para mais detalhes."
            });
        }
    } finally {
        setLoading(false);
    }
  };
  
  const getTitle = () => {
    switch(mode) {
        case 'create': 
            return xmlFile 
                ? 'Confirmar Lançamento de XML' 
                : `Novo Lançamento Manual`;
        case 'edit': return 'Alterar Lançamento Fiscal';
        case 'view': return 'Visualizar Lançamento Fiscal';
    }
  }
  
  const getInputValue = (name: string) => {
    const [section, field] = name.split('.');
    if (field) {
      const sectionData = formData[section as keyof typeof formData] as any;
      return sectionData?.[field] ?? '';
    }
    const value = formData[name as keyof typeof formData] as any;
    return value ?? '';
  };
  
  const renderNfseFields = () => (
    <Accordion type="multiple" defaultValue={['general', 'service']} className="w-full">
        <AccordionItem value="general">
            <AccordionTrigger>Informações Gerais</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="numeroNfse">Número da NFS-e</Label>
                        <Input id="numeroNfse" name="numeroNfse" value={getInputValue('numeroNfse')} onChange={handleInputChange} readOnly={isReadOnly || !!xmlFile} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="date">Data de Emissão</Label>
                        <Input id="date" name="date" type="date" value={formatDate(formData.date)} onChange={handleDateChange} readOnly={isReadOnly} />
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="prestador">
            <AccordionTrigger>Prestador do Serviço</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="prestador.nome">Razão Social</Label>
                    <Input id="prestador.nome" name="prestador.nome" value={getInputValue('prestador.nome')} onChange={handleInputChange} readOnly={isReadOnly} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="prestador.cnpj">CNPJ</Label>
                    <Input id="prestador.cnpj" name="prestador.cnpj" value={formatCnpj(getInputValue('prestador.cnpj'))} readOnly={isReadOnly || !!getInputValue('prestador.cnpj')} />
                </div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="tomador">
            <AccordionTrigger>Tomador do Serviço</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="tomador.nome">Razão Social</Label>
                    <Input id="tomador.nome" name="tomador.nome" value={getInputValue('tomador.nome')} onChange={handleInputChange} readOnly={isReadOnly} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tomador.cnpj">CNPJ</Label>
                    <Input id="tomador.cnpj" name="tomador.cnpj" value={formatCnpj(getInputValue('tomador.cnpj'))} readOnly={isReadOnly || !!getInputValue('tomador.cnpj')} />
                </div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="service">
            <AccordionTrigger>Serviços e Impostos</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="discriminacao">Discriminação do Serviço</Label>
                    <Textarea id="discriminacao" name="discriminacao" value={getInputValue('discriminacao')} onChange={handleInputChange} readOnly={isReadOnly} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="itemLc116">Item LC 116</Label>
                        <Input id="itemLc116" name="itemLc116" value={getInputValue('itemLc116')} onChange={handleInputChange} readOnly={isReadOnly} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="valorServicos">Valor dos Serviços</Label>
                        <Input id="valorServicos" name="valorServicos" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorServicos') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="valorPis">PIS</Label>
                        <Input id="valorPis" name="valorPis" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorPis') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="valorCofins">COFINS</Label>
                        <Input id="valorCofins" name="valorCofins" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorCofins') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="valorCsll">CSLL</Label>
                        <Input id="valorCsll" name="valorCsll" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorCsll') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="valorInss">INSS</Label>
                        <Input id="valorInss" name="valorInss" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorInss') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="valorIr">IR</Label>
                        <Input id="valorIr" name="valorIr" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorIr') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="valorLiquido" className="font-bold">Valor Líquido</Label>
                        <Input id="valorLiquido" name="valorLiquido" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorLiquido') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} className="font-bold" />
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    </Accordion>
  );

  const renderNfeFields = () => (
    <Accordion type="multiple" defaultValue={['general', 'emitter', 'recipient', 'products']} className="w-full">
        <AccordionItem value="general">
            <AccordionTrigger>Informações Gerais</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="chaveNfe">Chave da NF-e</Label>
                    <Input id="chaveNfe" name="chaveNfe" value={getInputValue('chaveNfe')} onChange={handleInputChange} readOnly={isReadOnly || !!xmlFile} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="date">Data de Emissão</Label>
                        <Input id="date" name="date" type="date" value={formatDate(formData.date)} onChange={handleDateChange} readOnly={isReadOnly} />
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="emitter">
            <AccordionTrigger>Emitente</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="emitente.nome">Razão Social</Label>
                    <Input id="emitente.nome" name="emitente.nome" value={getInputValue('emitente.nome')} onChange={handleInputChange} readOnly={isReadOnly} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="emitente.cnpj">CNPJ</Label>
                    <Input id="emitente.cnpj" name="emitente.cnpj" value={formatCnpj(getInputValue('emitente.cnpj'))} readOnly={isReadOnly || !!getInputValue('emitente.cnpj')} />
                </div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="recipient">
            <AccordionTrigger>Destinatário</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="destinatario.nome">Razão Social</Label>
                    <Input id="destinatario.nome" name="destinatario.nome" value={getInputValue('destinatario.nome')} onChange={handleInputChange} readOnly={isReadOnly} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="destinatario.cnpj">CNPJ</Label>
                    <Input id="destinatario.cnpj" name="destinatario.cnpj" value={formatCnpj(getInputValue('destinatario.cnpj'))} readOnly={isReadOnly || !!getInputValue('destinatario.cnpj')} />
                </div>
            </AccordionContent>
        </AccordionItem>
         <AccordionItem value="products">
            <AccordionTrigger>Produtos e Valores</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="valorProdutos">Valor dos Produtos</Label>
                        <Input id="valorProdutos" name="valorProdutos" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorProdutos') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="valorTotalNota" className="font-bold">Valor Total da Nota</Label>
                        <Input id="valorTotalNota" name="valorTotalNota" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorTotalNota') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} className="font-bold" />
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    </Accordion>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription asChild>
            <div>
              <div className="flex items-center gap-2">
                  <span>Tipo:</span>
                  <Badge variant="secondary" className="text-base capitalize">{formData.type}</Badge>
              </div>
              {xmlFile && <p>Arquivo: <span className="font-semibold">{xmlFile.file.name}</span></p>}
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[70vh] overflow-y-auto pr-4">
          {formData.type === 'servico' || (formData.type === 'saida' && (!!formData.prestador || manualLaunchType === 'servico')) ? (
            renderNfseFields()
          ) : (
            renderNfeFields()
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {mode === 'view' ? 'Fechar' : 'Cancelar'}
          </Button>
          {mode !== 'view' && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? 'Confirmar Lançamento' : 'Salvar Alterações'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
