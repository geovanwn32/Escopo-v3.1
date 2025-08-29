
"use client";

import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, query, where, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ReinfFile, Launch } from '@/types';
import { format } from 'date-fns';

interface ReinfDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  file: ReinfFile | null;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCnpj = (cnpj?: string) => cnpj ? cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : 'N/A';

export function ReinfDetailsModal({ isOpen, onClose, userId, companyId, file }: ReinfDetailsModalProps) {
    const [loading, setLoading] = useState(true);
    const [launches, setLaunches] = useState<Launch[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        if (!isOpen || !file || file.relatedLaunchIds.length === 0) {
            setLoading(false);
            setLaunches([]);
            return;
        }

        const fetchLaunches = async () => {
            setLoading(true);
            try {
                const launchesRef = collection(db, `users/${userId}/companies/${companyId}/launches`);
                const q = query(launchesRef, where(documentId(), 'in', file.relatedLaunchIds));
                const snapshot = await getDocs(q);
                const launchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Launch));
                setLaunches(launchesData);
            } catch (error) {
                console.error("Error fetching launch details:", error);
                toast({ variant: 'destructive', title: 'Erro ao buscar detalhes' });
            } finally {
                setLoading(false);
            }
        };

        fetchLaunches();
    }, [isOpen, file, userId, companyId, toast]);
    
    const getPartnerInfo = (launch: Launch) => {
        if (file?.type === 'R-2010') return { name: launch.prestador?.nome, cnpj: launch.prestador?.cnpj };
        if (file?.type === 'R-2020') return { name: launch.tomador?.nome, cnpj: launch.tomador?.cnpj };
        return { name: 'N/A', cnpj: 'N/A' };
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Detalhes do Evento Reinf - {file?.type}</DialogTitle>
                    <DialogDescription>
                        Notas fiscais incluídas no evento {file?.eventId} para o período {file?.period}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin"/></div>
                    ) : launches.length === 0 ? (
                        <p className="text-center text-muted-foreground p-8">Nenhuma nota fiscal de serviço com retenção de INSS encontrada para este evento.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Parceiro</TableHead>
                                    <TableHead>CNPJ/CPF</TableHead>
                                    <TableHead>Nº da Nota</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="text-right">Valor Bruto</TableHead>
                                    <TableHead className="text-right">Retenção INSS</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {launches.map(launch => {
                                    const partner = getPartnerInfo(launch);
                                    return (
                                        <TableRow key={launch.id}>
                                            <TableCell className="font-medium">{partner.name}</TableCell>
                                            <TableCell className="font-mono">{formatCnpj(partner.cnpj)}</TableCell>
                                            <TableCell>{launch.numeroNfse}</TableCell>
                                            <TableCell>{format(launch.date, 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(launch.valorServicos || 0)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(launch.valorInss || 0)}</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
