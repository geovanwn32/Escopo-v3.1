
"use client";

import { useState, useEffect, useMemo } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase.tsx';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from '@/types/user';
import { format } from 'date-fns';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MoreHorizontal, CheckCircle, Clock, Send, ShieldAlert, User, UserPlus, Ticket, PlusCircle } from "lucide-react";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { NotificationFormModal } from '@/components/admin/notification-form-modal';
import Link from 'next/link';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const licenseMap: Record<AppUser['licenseType'], string> = {
    pending_approval: 'Aprovação Pendente',
    trial: 'Teste',
    basica: 'Básica',
    profissional: 'Profissional',
    premium: 'Premium',
};

const licenseVariantMap: Record<AppUser['licenseType'], "default" | "secondary" | "destructive" | "outline"> = {
    pending_approval: 'destructive',
    trial: 'outline',
    basica: 'secondary',
    profissional: 'default',
    premium: 'default',
};

export default function AdminPage() {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
    const [notificationUser, setNotificationUser] = useState<Pick<AppUser, 'uid' | 'email'> | null>(null);
    const [isTicketsModalOpen, setIsTicketsModalOpen] = useState(false);
    const { user: adminUser } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (!adminUser) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const listAllUsers = httpsCallable(functions, 'listAllUsers');
                const usersResult = await listAllUsers();

                const usersData = (usersResult.data as any[]).map(u => ({
                    ...u,
                    createdAt: u.createdAt?._seconds ? new Date(u.createdAt._seconds * 1000) : new Date(),
                })) as AppUser[];
                
                setUsers(usersData);
            } catch (error: any) {
                console.error("Error fetching admin data:", error);
                toast({ variant: 'destructive', title: 'Erro ao buscar dados', description: error.message });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [adminUser, toast]);
    
    const metrics = useMemo(() => {
        const now = new Date();
        const activeUsers = users.filter(u => u.licenseType !== 'pending_approval').length;
        const newUsersThisMonth = users.filter(u => {
            const createdAt = u.createdAt as Date;
            return createdAt && createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
        }).length;
        
        return { activeUsers, newUsersThisMonth };
    }, [users]);


    const handleChangeLicense = async (targetUserId: string, newLicense: AppUser['licenseType']) => {
        setIsSubmitting(targetUserId);
        try {
            const updateUserLicense = httpsCallable(functions, 'updateUserLicense');
            await updateUserLicense({ userId: targetUserId, newLicense });
            setUsers(prev => prev.map(u => u.uid === targetUserId ? { ...u, licenseType: newLicense } : u));
            toast({ title: 'Licença atualizada!', description: 'A licença do usuário foi alterada com sucesso.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao atualizar licença.', description: error.message });
        } finally {
            setIsSubmitting(null);
        }
    };
    
    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Painel de Administração</h1>
                    <Button onClick={() => setIsTicketsModalOpen(true)}>CHAMADOS</Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                            <User className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.activeUsers}</div>
                            <p className="text-xs text-muted-foreground">Total de usuários com acesso liberado.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Novos Usuários (Mês)</CardTitle>
                            <UserPlus className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">+{metrics.newUsersThisMonth}</div>
                            <p className="text-xs text-muted-foreground">Novos cadastros em {format(new Date(), 'MMMM', { locale: ptBR })}.</p>
                        </CardContent>
                    </Card>
                </div>


                <Card>
                    <CardHeader>
                        <CardTitle>Gerenciamento de Usuários</CardTitle>
                        <CardDescription>
                            Aprove novos usuários, gerencie licenças e envie notificações.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Status da Licença</TableHead>
                                    <TableHead>Data de Criação</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.uid}>
                                        <TableCell className="font-medium">{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={licenseVariantMap[user.licenseType]}>
                                                {licenseMap[user.licenseType]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {format(user.createdAt as Date, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={isSubmitting === user.uid}>
                                                        {isSubmitting === user.uid ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    {user.licenseType === 'pending_approval' && (
                                                        <DropdownMenuItem onClick={() => handleChangeLicense(user.uid, 'basica')}>
                                                            <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Aprovar (Licença Básica)
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => setNotificationUser({ uid: user.uid, email: user.email! })}>
                                                        <Send className="mr-2 h-4 w-4" /> Enviar Notificação
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel>Alterar Licença</DropdownMenuLabel>
                                                    {Object.keys(licenseMap).filter(key => key !== 'pending_approval').map(licenseKey => (
                                                        <DropdownMenuItem 
                                                            key={licenseKey} 
                                                            disabled={user.licenseType === licenseKey}
                                                            onClick={() => handleChangeLicense(user.uid, licenseKey as AppUser['licenseType'])}
                                                        >
                                                            <ShieldAlert className="mr-2 h-4 w-4" /> {licenseMap[licenseKey as keyof typeof licenseMap]}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {notificationUser && (
                    <NotificationFormModal 
                        isOpen={!!notificationUser}
                        onClose={() => setNotificationUser(null)}
                        targetUser={notificationUser}
                    />
                )}
            </div>

            <Dialog open={isTicketsModalOpen} onOpenChange={setIsTicketsModalOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader className="flex-row justify-between items-center">
                        <div>
                            <DialogTitle>Central de Chamados de Suporte</DialogTitle>
                            <DialogDescription>
                                Visualize e gerencie todos os chamados abertos pelos usuários.
                            </DialogDescription>
                        </div>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Abrir Novo Chamado
                        </Button>
                    </DialogHeader>
                    <div className="py-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Problema</TableHead>
                                    <TableHead>Usuário</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>ID da Requisição</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Nenhum chamado encontrado.
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                     <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTicketsModalOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
