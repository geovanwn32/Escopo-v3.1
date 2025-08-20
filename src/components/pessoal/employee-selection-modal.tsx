
"use client";

import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, UserCheck } from 'lucide-react';
import type { Employee } from '@/types/employee';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface EmployeeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (employee: Employee) => void;
  userId: string;
  companyId: string;
}

export function EmployeeSelectionModal({ isOpen, onClose, onSelect, userId, companyId }: EmployeeSelectionModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !userId || !companyId) return;

    setLoading(true);
    const employeesRef = collection(db, `users/${userId}/companies/${companyId}/employees`);
    const q = query(employeesRef, where('ativo', '==', true), orderBy('nomeCompleto', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const employeesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            dataAdmissao: (doc.data().dataAdmissao as any).toDate(),
            dataNascimento: (doc.data().dataNascimento as any).toDate(),
        } as Employee));
        setEmployees(employeesData);
        setLoading(false);
    }, (error) => {
        console.error("Erro ao buscar funcionários:", error);
        toast({ variant: 'destructive', title: "Erro ao buscar funcionários" });
        setLoading(false);
    });

    return () => unsubscribe();
}, [isOpen, userId, companyId, toast]);


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
                {loading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin" /></div>
                ) : (
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
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
