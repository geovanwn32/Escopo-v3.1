
"use client";

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, Search, UserCheck } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import type { Partner, Employee } from '@/types';

interface Emitter {
    id: string;
    name: string;
    cpfCnpj: string;
    type: 'Parceiro' | 'Funcionário';
    address: string;
}

interface EmitterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emitter: Emitter) => void;
  partners: Partner[];
  employees: Employee[];
}

export function EmitterSelectionModal({ isOpen, onClose, onSelect, partners, employees }: EmitterSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const combinedList = useMemo(() => {
    const partnerEmitters: Emitter[] = partners.map(p => ({
        id: p.id!,
        name: p.razaoSocial,
        cpfCnpj: p.cpfCnpj,
        type: 'Parceiro',
        address: `${p.logradouro || ''}, ${p.numero || ''} - ${p.bairro || ''}, ${p.cidade || ''}/${p.uf || ''}`
    }));
    const employeeEmitters: Emitter[] = employees.map(e => ({
        id: e.id!,
        name: e.nomeCompleto,
        cpfCnpj: e.cpf,
        type: 'Funcionário',
        address: `${e.logradouro}, ${e.numero} - ${e.bairro}, ${e.cidade}/${e.uf}`
    }));
    return [...partnerEmitters, ...employeeEmitters];
  }, [partners, employees]);

  const filteredEmitters = useMemo(() => {
    return combinedList.filter(emitter =>
      emitter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emitter.cpfCnpj.includes(searchTerm.replace(/\D/g, ''))
    );
  }, [combinedList, searchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar Emitente</DialogTitle>
          <DialogDescription>
            Busque e selecione um parceiro ou funcionário para ser o emitente do recibo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nome ou CPF/CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>

            <div className="border rounded-md max-h-[50vh] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>CPF/CNPJ</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredEmitters.length > 0 ? (
                                filteredEmitters.map(emitter => (
                                <TableRow key={`${emitter.type}-${emitter.id}`}>
                                    <TableCell className="font-medium">{emitter.name}</TableCell>
                                    <TableCell>{emitter.cpfCnpj}</TableCell>
                                    <TableCell>{emitter.type}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => onSelect(emitter)}>
                                            <UserCheck className="mr-2 h-4 w-4"/>
                                            Selecionar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                    Nenhum emitente encontrado.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
