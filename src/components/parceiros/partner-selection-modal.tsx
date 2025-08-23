

"use client";

import { useEffect, useState, useMemo } from 'react';
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
  partners: Partner[];
  partnerType: PartnerType;
}

export function PartnerSelectionModal({ isOpen, onClose, onSelect, partners, partnerType }: PartnerSelectionModalProps) {
  const [loading, setLoading] = useState(false); // Loading is now managed by the parent page
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPartners = useMemo(() => {
    if (!partners) return [];
    return partners
      .filter(p => p.type === partnerType)
      .filter(partner =>
        partner.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partner.cpfCnpj.includes(searchTerm.replace(/\D/g, ''))
      );
  }, [partners, searchTerm, partnerType]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar {partnerType === 'cliente' ? 'Cliente' : partnerType === 'fornecedor' ? 'Fornecedor' : 'Parceiro'}</DialogTitle>
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
