
"use client";

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Package, Wrench, PlusCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { Produto } from '@/types/produto';
import type { Servico } from '@/types/servico';

export interface CatalogoItem {
  id: string;
  type: 'produto' | 'servico';
  description: string;
  unitPrice: number;
  itemLc?: string; // Now included for services
}

interface ItemSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (items: CatalogoItem[]) => void;
  userId: string;
  companyId: string;
}

export function ItemSelectionModal({ isOpen, onClose, onSelect, userId, companyId }: ItemSelectionModalProps) {
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<CatalogoItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchItems = async () => {
      if (!userId || !companyId) return;
      setLoading(true);
      try {
        const productsRef = collection(db, `users/${userId}/companies/${companyId}/produtos`);
        const servicesRef = collection(db, `users/${userId}/companies/${companyId}/servicos`);
        
        const [productsSnap, servicesSnap] = await Promise.all([
            getDocs(query(productsRef, orderBy('descricao'))),
            getDocs(query(servicesRef, orderBy('descricao')))
        ]);

        const productsData: CatalogoItem[] = productsSnap.docs.map(doc => {
            const data = doc.data() as Produto;
            return { id: doc.id, type: 'produto', description: data.descricao, unitPrice: data.valorUnitario };
        });
        const servicesData: CatalogoItem[] = servicesSnap.docs.map(doc => {
            const data = doc.data() as Servico;
            return { id: doc.id, type: 'servico', description: data.descricao, unitPrice: data.valorPadrao, itemLc: data.codigo };
        });

        setItems([...productsData, ...servicesData].sort((a,b) => a.description.localeCompare(b.description)));

      } catch (error) {
        toast({ variant: 'destructive', title: "Erro ao buscar catálogo", description: "Não foi possível carregar produtos e serviços." });
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchItems();
      setSelectedItems([]); // Reset selection when modal opens
    }
  }, [isOpen, userId, companyId, toast]);

  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);
  
  const handleToggleItem = (item: CatalogoItem) => {
    setSelectedItems(prev => {
        const isSelected = prev.some(i => i.id === item.id);
        if (isSelected) {
            return prev.filter(i => i.id !== item.id);
        } else {
            return [...prev, item];
        }
    });
  }
  
  const handleConfirmSelection = () => {
    onSelect(selectedItems);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Selecionar Itens do Catálogo</DialogTitle>
          <DialogDescription>
            Busque e selecione produtos ou serviços para adicionar ao orçamento.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    autoFocus
                />
            </div>

            <div className="border rounded-md max-h-[50vh] overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Tipo</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredItems.length > 0 ? (
                                filteredItems.map(item => (
                                <TableRow 
                                    key={item.id}
                                    className="cursor-pointer"
                                    onClick={() => handleToggleItem(item)}
                                    data-state={selectedItems.some(i => i.id === item.id) ? 'selected' : ''}
                                >
                                    <TableCell>
                                       {item.type === 'produto' ? <Package className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                                    </TableCell>
                                    <TableCell className="font-medium">{item.description}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant={selectedItems.some(i => i.id === item.id) ? 'default' : 'outline'}>
                                            {selectedItems.some(i => i.id === item.id) ? 'Selecionado' : 'Selecionar'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                    Nenhum item encontrado.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
        <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleConfirmSelection} disabled={selectedItems.length === 0}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar {selectedItems.length > 0 ? selectedItems.length : ''} Itens
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
