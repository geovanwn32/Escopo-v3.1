
"use client";

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, Search, UserCheck, PlusCircle } from 'lucide-react';
import type { Partner } from '@/types/partner';
import type { Employee } from '@/types/employee';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import Link from 'next/link';

interface EmitterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emitter: {id: string, name: string, address?: string}) => void;
  partners: Partner[];
  employees: Employee[];
}

export function EmitterSelectionModal({ isOpen, onClose, onSelect, partners, employees }: EmitterSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const combinedList = useMemo(() => {
    const partnerEmitters = partners
        .filter(p => p.type === 'cliente' || p.type === 'fornecedor')
        .map(p => ({
            id: p.id!,
            name: p.razaoSocial,
            type: p.type.charAt(0).toUpperCase() + p.type.slice(1) as 'Cliente' | 'Fornecedor',
            address: `${p.logradouro || ''}, ${p.numero || ''}, ${p.bairro || ''}`
        }));
    
    const employeeEmitters = employees.map(e => ({
        id: e.id!,
        name: e.nomeCompleto,
        type: 'Funcionário' as const,
        address: `${e.logradouro || ''}, ${e.numero || ''}, ${e.bairro || ''}`
    }));

    return [...partnerEmitters, ...employeeEmitters];
  }, [partners, employees]);

  const filteredEmitters = useMemo(() => {
    return combinedList.filter(emitter =>
      emitter.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [combinedList, searchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar Emitente</DialogTitle>
          <DialogDescription>
            Busque e selecione um cliente ou funcionário como emitente do recibo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>

            <div className="border rounded-md max-h-[50vh] overflow-y-auto">
                {partners.length === 0 && employees.length === 0 ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredEmitters.length > 0 ? (
                                filteredEmitters.map(emitter => (
                                <TableRow key={`${emitter.type}-${emitter.id}`}>
                                    <TableCell className="font-medium">{emitter.name}</TableCell>
                                    <TableCell><Badge variant="outline">{emitter.type}</Badge></TableCell>
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
                                    <TableCell colSpan={3} className="h-24 text-center">
                                    Nenhum emitente encontrado.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
        <DialogFooter className="justify-between">
            <div className="flex gap-2">
                 <Button asChild variant="outline">
                    <Link href="/parceiros">
                        <PlusCircle className="mr-2 h-4 w-4" /> Cadastrar Cliente/Fornecedor
                    </Link>
                </Button>
                 <Button asChild variant="outline">
                    <Link href="/funcionarios">
                        <PlusCircle className="mr-2 h-4 w-4" /> Cadastrar Funcionário
                    </Link>
                </Button>
            </div>
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
