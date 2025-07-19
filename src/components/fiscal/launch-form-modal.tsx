
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Launch } from '@/app/(app)/fiscal/page';

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
  const [parsedData, setParsedData] = useState<Partial<z.infer<typeof launchSchema>>>({});
  const { toast } = useToast();
  const isReadOnly = mode === 'view';

  useEffect(() => {
    if (isOpen) {
      if (mode === 'create' && xmlFile) {
        const data = parseXml(xmlFile.content);
        setParsedData(data);
      } else if ((mode === 'edit' || mode === 'view') && launch) {
        setParsedData({
          fileName: launch.fileName,
          type: launch.type,
          value: launch.value,
          date: launch.date,
          chaveNfe: launch.chaveNfe,
          numeroNfse: launch.numeroNfse,
        });
      }
    }
  }, [isOpen, xmlFile, launch, mode]);

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
            value: parsedData.value || 0,
            date: parsedData.date || new Date(),
            chaveNfe: parsedData.chaveNfe || null,
            numeroNfse: parsedData.numeroNfse || null,
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
            // TODO: Implementar a lógica de atualização no Firestore
            // const launchRef = doc(db, `users/${userId}/companies/${companyId}/launches`, launch.id);
            // await setDoc(launchRef, launchData, { merge: true });
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
  
  const formatCurrency = (value?: number) => {
    if (value === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const formatDate = (date?: Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

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
            <Input id="key" value={parsedData.chaveNfe || parsedData.numeroNfse || ''} readOnly={isReadOnly} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">Data</Label>
            <Input id="date" value={formatDate(parsedData.date)} readOnly={isReadOnly} className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="value" className="text-right">Valor</Label>
            <Input id="value" value={formatCurrency(parsedData.value)} readOnly={isReadOnly} className="col-span-3" />
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

    