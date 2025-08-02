

"use client";

import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, UserCheck } from 'lucide-react';
import type { Employee } from '@/types/employee';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';

interface EmployeeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (employee: Employee) => void;
  employees: Employee[];
}

export function EmployeeSelectionModal({ isOpen, onClose, onSelect, employees }: EmployeeSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(employee =>
      employee.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.cpf.includes(searchTerm)
    );
  }, [employees, searchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar Funcionário</DialogTitle>
          <DialogDescription>
            Busque e selecione um funcionário.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nome ou CPF..."
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
                            <TableHead>Cargo</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEmployees.length > 0 ? (
                            filteredEmployees.map(employee => (
                            <TableRow key={employee.id}>
                                <TableCell className="font-medium">{employee.nomeCompleto}</TableCell>
                                <TableCell>{employee.cargo}</TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" onClick={() => onSelect(employee)}>
                                        <UserCheck className="mr-2 h-4 w-4"/>
                                        Selecionar
                                    </Button>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                Nenhum funcionário encontrado.
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
