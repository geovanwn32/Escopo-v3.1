
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface XmlFile {
  file: File;
  content: string;
  status: 'pending' | 'launched' | 'error';
  type: 'entrada' | 'saida' | 'servico' | 'desconhecido';
}

interface LaunchFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  xmlFile: XmlFile;
  userId: string;
  companyId: string;
  onLaunchSuccess: (fileName: string) => void;
}

const launchSchema = z.object({
  fileName: z.string(),
  type: z.string(),
  value: z.number(),
  date: z.date(),
  chaveNfe: z.string().optional(),
  numeroNfse: z.string().optional(),
});

function parseXml(xmlString: string) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const get = (tag: string, parent: Document | Element = xmlDoc) => parent.getElementsByTagName(tag)[0]?.textContent ?? '';

    let data: Partial<z.infer<typeof launchSchema>> = {};

    if (get('nfeProc')) { // NF-e
        const infNFe = xmlDoc.getElementsByTagName('infNFe')[0];
        data.chaveNfe = infNFe?.getAttribute('Id')?.replace('NFe', '') || 'Chave não encontrada';
        data.value = parseFloat(get('vNF') || '0');
        const dateStr = get('dhEmi');
        data.date = dateStr ? new Date(dateStr) : new Date();

    } else if (get('NFSe')) { // NFS-e
        data.numeroNfse = get('nNFSe') || 'Número não encontrado';
        data.value = parseFloat(get('vLiq') || get('vServ') || '0');
        const dateStr = get('dhProc') || get('dCompet');
        data.date = dateStr ? new Date(dateStr) : new Date();
    }
    return data;
}

export function LaunchFormModal({ isOpen, onClose, xmlFile, userId, companyId, onLaunchSuccess }: LaunchFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<Partial<z.infer<typeof launchSchema>>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const data = parseXml(xmlFile.content);
      setParsedData(data);
    }
  }, [isOpen, xmlFile.content]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
        const launchData: z.infer<typeof launchSchema> = {
            fileName: xmlFile.file.name,
            type: xmlFile.type,
            value: parsedData.value || 0,
            date: parsedData.date || new Date(),
            chaveNfe: parsedData.chaveNfe,
            numeroNfse: parsedData.numeroNfse
        };

        await launchSchema.parseAsync(launchData);

        const launchesRef = collection(db, `users/${userId}/companies/${companyId}/launches`);
        await addDoc(launchesRef, launchData);

        toast({
            title: "Lançamento realizado!",
            description: `O arquivo ${xmlFile.file.name} foi lançado com sucesso.`
        });
        onLaunchSuccess(xmlFile.file.name);

    } catch (error) {
        console.error(error);
        toast({
            variant: 'destructive',
            title: "Erro ao Lançar",
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirmar Lançamento Fiscal</DialogTitle>
          <DialogDescription>
            Confirme os dados do arquivo <span className="font-bold">{xmlFile.file.name}</span> antes de salvar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">Tipo</Label>
            <Input id="type" value={xmlFile.type.charAt(0).toUpperCase() + xmlFile.type.slice(1)} readOnly className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="key" className="text-right">Chave/Número</Label>
            <Input id="key" value={parsedData.chaveNfe || parsedData.numeroNfse || ''} readOnly className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">Data</Label>
            <Input id="date" value={formatDate(parsedData.date)} readOnly className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="value" className="text-right">Valor</Label>
            <Input id="value" value={formatCurrency(parsedData.value)} readOnly className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar Lançamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    