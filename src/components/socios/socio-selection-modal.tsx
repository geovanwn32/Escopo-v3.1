
"use client";

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, UserCheck } from 'lucide-react';
import type { Socio } from '@/types/socio';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Timestamp } from 'firebase/firestore';

interface SocioSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (socio: Socio) => void;
  userId: string;
  companyId: string;
}

export function SocioSelectionModal({ isOpen, onClose, onSelect, userId, companyId }: SocioSelectionModalProps) {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchSocios = async () => {
      if (!userId || !companyId) return;
      setLoading(true);
      try {
        const sociosRef = collection(db, `users/${userId}/companies/${companyId}/socios`);
        const q = query(sociosRef, orderBy('nomeCompleto', 'asc'));
        const snapshot = await getDocs(q);
        setSocios(snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            dataEntrada: (doc.data().dataEntrada as Timestamp).toDate(),
            dataNascimento: (doc.data().dataNascimento as Timestamp).toDate(),
        } as Socio)));
      } catch (error) {
        toast({ variant: 'destructive', title: "Erro ao buscar sócios", description: "Não foi possível carregar a lista de sócios." });
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchSocios();
    }
  }, [isOpen, userId, companyId, toast]);

  const filteredSocios = useMemo(() => {
    return socios.filter(socio =>
      socio.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      socio.cpf.includes(searchTerm)
    );
  }, [socios, searchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar Sócio</DialogTitle>
          <DialogDescription>
            Busque e selecione um sócio para calcular o pró-labore.
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
                                <TableHead>Pró-labore</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSocios.length > 0 ? (
                                filteredSocios.map(socio => (
                                <TableRow key={socio.id}>
                                    <TableCell className="font-medium">{socio.nomeCompleto}</TableCell>
                                    <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(socio.proLabore)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => onSelect(socio)}>
                                            <UserCheck className="mr-2 h-4 w-4"/>
                                            Selecionar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                    Nenhum sócio encontrado.
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
