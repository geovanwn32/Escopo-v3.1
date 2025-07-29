
"use client";

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, UserCheck } from 'lucide-react';
import type { Partner, PartnerType } from '@/types/partner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';

interface PartnerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (partner: Partner) => void;
  userId: string;
  companyId: string;
  partnerType: PartnerType;
}

export function PartnerSelectionModal({ isOpen, onClose, onSelect, userId, companyId, partnerType }: PartnerSelectionModalProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchPartners = async () => {
      if (!userId || !companyId) return;
      setLoading(true);
      try {
        const partnersRef = collection(db, `users/${userId}/companies/${companyId}/partners`);
        // Query only by type, and sort client-side to avoid composite index requirement
        const q = query(partnersRef, where('type', '==', partnerType));
        const snapshot = await getDocs(q);
        const partnersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner));
        // Sort the data alphabetically by 'razaoSocial' on the client side
        partnersData.sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));
        setPartners(partnersData);
      } catch (error) {
        console.error("Error fetching partners:", error);
        toast({ variant: 'destructive', title: "Erro ao buscar parceiros", description: "Não foi possível carregar a lista de parceiros." });
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchPartners();
    }
  }, [isOpen, userId, companyId, partnerType, toast]);

  const filteredPartners = useMemo(() => {
    return partners.filter(partner =>
      partner.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.cpfCnpj.includes(searchTerm.replace(/\D/g, ''))
    );
  }, [partners, searchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar {partnerType === 'cliente' ? 'Cliente' : 'Parceiro'}</DialogTitle>
          <DialogDescription>
            Busque e selecione um parceiro.
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
                {loading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome/Razão Social</TableHead>
                                <TableHead>CPF/CNPJ</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPartners.length > 0 ? (
                                filteredPartners.map(partner => (
                                <TableRow key={partner.id}>
                                    <TableCell className="font-medium">{partner.razaoSocial}</TableCell>
                                    <TableCell>{partner.cpfCnpj}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => onSelect(partner)}>
                                            <UserCheck className="mr-2 h-4 w-4"/>
                                            Selecionar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                    Nenhum parceiro encontrado.
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
