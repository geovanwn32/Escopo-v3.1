
"use client";

import { useState, useEffect, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Launch } from '@/app/(app)/fiscal/page';
import { parse, format, isValid } from 'date-fns';

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
  mode: 'create' | 'edit' | 'view';
  userId: string;
  companyId: string;
  onLaunchSuccess: (fileName: string) => void;
}

const launchSchema = z.object({
  fileName: z.string(),
  type: z.string(),
  value: z.number(),
  date: z.date(),
  chaveNfe: z.string().optional().nullable(),
  numeroNfse: z.string().optional().nullable(),
});

function parseXml(xmlString: string) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const get = (tag: string, parent: Document | Element = xmlDoc) => parent.getElementsByTagName(tag)[0]?.textContent ?? '';
    const getFromAnywhere = (tag: string) => xmlDoc.getElementsByTagNameNS('*', tag)[0]?.textContent ?? '';

    let data: Partial<z.infer<typeof launchSchema>> = {};

    // NF-e
    const nfeProc = xmlDoc.getElementsByTagName('nfeProc')[0];
    if (nfeProc) { 
        const infNFe = nfeProc.getElementsByTagName('infNFe')[0];
        data.chaveNfe = infNFe?.getAttribute('Id')?.replace('NFe', '') || 'Chave não encontrada';
        data.value = parseFloat(get('vNF', nfeProc) || '0');
        const dateStr = get('dhEmi', nfeProc);
        data.date = dateStr ? new Date(dateStr) : new Date();

    } 
    // NFS-e
    else { 
        data.numeroNfse = getFromAnywhere('nNFSe') || getFromAnywhere('Numero') || 'Número não encontrado';
        data.value = parseFloat(getFromAnywhere('vLiq') || getFromAnywhere('ValorLiquidoNfse') || getFromAnywhere('vServ') || '0');
        const dateStr = getFromAnywhere('dhProc') || getFromAnywhere('dCompet') || getFromAnywhere('DataEmissao');
        data.date = dateStr ? new Date(dateStr) : new Date();
    }
    return data;
}

export function LaunchFormModal({ isOpen, onClose, xmlFile, launch, mode, userId, companyId, onLaunchSuccess }: LaunchFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<z.infer<typeof launchSchema>>>({});
  const { toast } = useToast();
  const isReadOnly = mode === 'view';

  const formatCurrency = (value?: number) => {
    if (value === undefined || isNaN(value)) return '';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const parseCurrency = (value: string): number => {
    const number = parseFloat(value.replace(/[^0-9,]/g, '').replace(',', '.'));
    return isNaN(number) ? 0 : number;
  };

  const formatDate = (date?: Date): string => {
    if (!date || !isValid(date)) return '';
    return format(date, 'dd/MM/yyyy');
  };
  
  const parseDate = (dateStr: string): Date | null => {
    const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
    return isValid(parsed) ? parsed : null;
  };

  useEffect(() => {
    let initialData: Partial<z.infer<typeof launchSchema>> = {};
    if (isOpen) {
      if (mode === 'create' && xmlFile) {
        initialData = parseXml(xmlFile.content);
      } else if ((mode === 'edit' || mode === 'view') && launch) {
        initialData = {
          fileName: launch.fileName,
          type: launch.type,
          value: launch.value,
          date: launch.date,
          chaveNfe: launch.chaveNfe,
          numeroNfse: launch.numeroNfse,
        };
      }
      setFormData(initialData);
    }
  }, [isOpen, xmlFile, launch, mode]);

  const handleInputChange = (field: keyof z.infer<typeof launchSchema>, value: string) => {
    setFormData(prev => {
        let parsedValue: any = value;
        if (field === 'value') {
            parsedValue = parseCurrency(value);
        } else if (field === 'date') {
            const date = parseDate(value);
            if (date) {
                parsedValue = date;
            } else {
                return { ...prev, [field]: undefined }; 
            }
        }
        return { ...prev, [field]: parsedValue };
    });
  };

  const getInputValue = (field: keyof z.infer<typeof launchSchema>): string => {
        const value = formData[field];
        if (value === undefined || value === null) return '';
        if (field === 'value') return formatCurrency(value as number);
        if (field === 'date') return formatDate(value as Date);
        return String(value);
  };


  const handleSubmit = async () => {
    if (mode === 'view') {
        onClose();
        return;
    }
    setLoading(true);
    try {
        const launchData = {
            fileName: xmlFile?.file.name || launch?.fileName || 'N/A',
            type: xmlFile?.type || launch?.type || 'desconhecido',
            value: formData.value || 0,
            date: formData.date || new Date(),
            chaveNfe: formData.chaveNfe || null,
            numeroNfse: formData.numeroNfse || null,
        };
        
        await launchSchema.parseAsync(launchData);

        if (mode === 'create') {
            const launchesRef = collection(db, `users/${userId}/companies/${companyId}/launches`);
            await addDoc(launchesRef, launchData);
            toast({
                title: "Lançamento realizado!",
                description: `O arquivo ${xmlFile!.file.name} foi lançado com sucesso.`
            });
            onLaunchSuccess(xmlFile!.file.name);
        } else if (mode === 'edit' && launch) {
            const launchRef = doc(db, `users/${userId}/companies/${companyId}/launches`, launch.id);
            await updateDoc(launchRef, launchData);
            toast({
                title: "Lançamento atualizado!",
                description: "As alterações foram salvas com sucesso."
            });
            onClose();
        }

    } catch (error) {
        console.error(error);
        toast({
            variant: 'destructive',
            title: "Erro ao Salvar",
            description: "Ocorreu um erro ao salvar os dados. Verifique o console para mais detalhes."
        });
    } finally {
        setLoading(false);
    }
  };
  
  const getTitle = () => {
    switch(mode) {
        case 'create': return 'Confirmar Lançamento Fiscal';
        case 'edit': return 'Alterar Lançamento Fiscal';
        case 'view': return 'Visualizar Lançamento Fiscal';
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            Confirme os dados do arquivo <span className="font-bold">{xmlFile?.file.name || launch?.fileName}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">Tipo</Label>
            <Input id="type" value={(xmlFile?.type || launch?.type || '').charAt(0).toUpperCase() + (xmlFile?.type || launch?.type || '').slice(1)} readOnly className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="key" className="text-right">Chave/Número</Label>
            <Input 
                id="key" 
                value={getInputValue(formData.chaveNfe ? 'chaveNfe' : 'numeroNfse')}
                onChange={(e) => handleInputChange(formData.chaveNfe ? 'chaveNfe' : 'numeroNfse', e.target.value)} 
                readOnly={isReadOnly} 
                className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">Data</Label>
            <Input 
                id="date" 
                value={getInputValue('date')} 
                onChange={(e) => handleInputChange('date', e.target.value)}
                readOnly={isReadOnly} 
                className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="value" className="text-right">Valor</Label>
            <Input 
                id="value" 
                value={getInputValue('value')} 
                onChange={(e) => handleInputChange('value', e.target.value)}
                readOnly={isReadOnly} 
                className="col-span-3" />
          </div>
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
