
"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { createAccountingEntries } from '@/ai/flows/create-accounting-entries-flow';
import type { CreateAccountingEntriesInput } from '@/ai/schemas/accounting-entries-schemas';

interface ImportAccountingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
}

const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
const months = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export function ImportAccountingModal({ isOpen, onClose, userId, companyId }: ImportAccountingModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
  const { toast } = useToast();

  const handleImport = async () => {
    setLoading(true);
    try {
      const input: CreateAccountingEntriesInput = {
        userId,
        companyId,
        year: parseInt(selectedYear),
        month: parseInt(selectedMonth),
      };
      const result = await createAccountingEntries(input);

      if (result.success) {
        toast({
          title: "Importação Concluída!",
          description: `${result.entriesCreated} lançamentos contábeis foram criados com sucesso.`,
        });
        onClose();
      } else {
         toast({
            variant: 'destructive',
            title: "Erro na Importação",
            description: result.message,
        });
      }
    } catch (error) {
      console.error("Error importing to accounting:", error);
      toast({
        variant: 'destructive',
        title: "Erro Inesperado",
        description: "Ocorreu um erro ao importar os lançamentos. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Lançamentos para Contabilidade</DialogTitle>
          <DialogDescription>
            Selecione o período (mês e ano) para importar os lançamentos fiscais e gerar as partidas contábeis correspondentes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o Mês" />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o Ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={String(year)}>
                  {String(year)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
