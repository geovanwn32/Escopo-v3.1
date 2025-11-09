
"use client";

import { useState, useEffect } from 'react';
import { collectionGroup, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase.tsx';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from '@/types/user';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MoreHorizontal, CheckCircle, Clock, Send, ShieldAlert, Ticket } from "lucide-react";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { NotificationFormModal } from '@/components/admin/notification-form-modal';
import Link from 'next/link';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
    premium: 'default', // Same as professional for now
};

export default function AdminPage() {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
    const [notificationUser, setNotificationUser] = useState<Pick<AppUser, 'uid' | 'email'> | null>(null);
    const { user: adminUser } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (!adminUser) return;
        const fetchUsers = async () => {
            setLoading(true);
            try {
                // This query assumes you have appropriate Firestore rules
                const usersRef = collectionGroup(db, 'users');
                const snapshot = await getDocs(usersRef);
                const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
                setUsers(usersData);
            } catch (error) {
                console.error("Original error fetching users:", error);
                 const permissionError = new FirestorePermissionError({
                    path: `users (collectionGroup)`,
                    operation: 'list',
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ variant: 'destructive', title: 'Erro de Permissão', description: 'Você não tem permissão para visualizar todos os usuários.' });
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [adminUser, toast]);

    const handleChangeLicense = async (targetUserId: string, newLicense: AppUser['licenseType']) => {
        setIsSubmitting(targetUserId);
        const userRef = doc(db, 'users', targetUserId);
        
        updateDoc(userRef, { licenseType: newLicense }).then(() => {
            setUsers(prev => prev.map(u => u.uid === targetUserId ? { ...u, licenseType: newLicense } : u));
            toast({ title: 'Licença atualizada!', description: 'A licença do usuário foi alterada com sucesso.' });
            setIsSubmitting(null);
        }).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { licenseType: newLicense },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Erro ao atualizar licença.' });
            setIsSubmitting(null);
        });
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Painel de Administração</h1>
                <Button asChild>
                    <Link href="/admin/chamados">
                        <Ticket className="mr-2 h-4 w-4"/> Ver Todos os Chamados
                    </Link>
                </Button>
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
    );
}
