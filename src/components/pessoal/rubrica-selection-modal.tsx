

"use client";

import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, PlusCircle } from 'lucide-react';
import type { Rubrica } from '@/types/rubrica';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';

interface RubricaSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (rubrica: Rubrica) => void;
  rubricas: Rubrica[];
}

export function RubricaSelectionModal({ isOpen, onClose, onSelect, rubricas }: RubricaSelectionModalProps) {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRubricas = useMemo(() => {
    return rubricas.filter(rubrica =>
      rubrica.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rubrica.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rubricas, searchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar Rubrica</DialogTitle>
          <DialogDescription>
            Busque e selecione um evento para adicionar à folha de pagamento.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por código ou descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>

            <div className="border rounded-md max-h-[50vh] overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRubricas.length > 0 ? (
                                filteredRubricas.map(rubrica => (
                                <TableRow key={rubrica.id}>
                                    <TableCell className="font-mono">{rubrica.codigo}</TableCell>
                                    <TableCell>{rubrica.descricao}</TableCell>
                                    <TableCell>
                                        <Badge variant={rubrica.tipo === 'provento' ? 'default' : 'destructive'}>
                                            {rubrica.tipo.charAt(0).toUpperCase() + rubrica.tipo.slice(1)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => onSelect(rubrica)}>
                                            <PlusCircle className="mr-2 h-4 w-4"/>
                                            Adicionar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                    Nenhuma rubrica encontrada.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
