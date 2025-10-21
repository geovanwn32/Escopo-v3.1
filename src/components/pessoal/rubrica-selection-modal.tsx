

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
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface RubricaSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (rubrica: Rubrica) => void;
  userId: string;
  companyId: string;
}

export function RubricaSelectionModal({ isOpen, onClose, onSelect, userId, companyId }: RubricaSelectionModalProps) {
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  useEffect(() => {
    if (!isOpen || !userId || !companyId) return;

    setLoading(true);
    const rubricasRef = collection(db, `users/${userId}/companies/${companyId}/rubricas`);
    const q = query(rubricasRef, orderBy('descricao', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rubrica));
        setRubricas(data);
        setLoading(false);
    }, (error) => {
        console.error("Erro ao buscar rubricas:", error);
        toast({ variant: 'destructive', title: "Erro ao buscar rubricas" });
        setLoading(false);
    });

    return () => unsubscribe();
}, [isOpen, userId, companyId, toast]);


  const filteredRubricas = useMemo(() => {
    if (!rubricas) return []; // Retorna um array vazio se rubricas for undefined
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
