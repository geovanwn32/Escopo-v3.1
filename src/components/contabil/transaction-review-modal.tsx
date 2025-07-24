
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BankTransaction } from '@/ai/flows/extract-transactions-flow';
import { ScrollArea } from '../ui/scroll-area';

interface TransactionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: BankTransaction[];
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
};

export function TransactionReviewModal({ isOpen, onClose, transactions }: TransactionReviewModalProps) {
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh]">
        <DialogHeader>
          <DialogTitle>Transações Extraídas do Extrato</DialogTitle>
          <DialogDescription>
            Revise as transações extraídas pela IA. Futuramente, você poderá editá-las e importá-las como lançamentos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-hidden">
             <ScrollArea className="h-full">
                <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {transactions.map((tx, index) => (
                    <TableRow key={index}>
                        <TableCell className="font-mono">{tx.date}</TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell className="text-right">
                        <Badge variant={tx.type === 'credit' ? 'default' : 'destructive'}>
                            {formatCurrency(tx.amount)}
                        </Badge>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </ScrollArea>
        </div>
        
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button disabled>Importar Lançamentos (Em Breve)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
