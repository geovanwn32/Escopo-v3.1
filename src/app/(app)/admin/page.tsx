
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, UserPlus, ShieldCheck, UserCheck, UserX, MessageSquare, MoreHorizontal, RefreshCw, CheckCircle, Sparkles, Star } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { Company } from '@/types/company';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import type { AppUser } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { NotificationFormModal } from '@/components/admin/notification-form-modal';
import { cn } from '@/lib/utils';


const ADMIN_COMPANY_CNPJ = '00000000000000';
const SUPER_ADMIN_EMAIL = 'geovaniwn@gmail.com';

interface AdminUserView {
    uid: string;
    email?: string;
    disabled: boolean;
    creationTime: string;
    lastSignInTime: string;
    licenseType: AppUser['licenseType'];
}


export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  // Admin state
  const [allUsers, setAllUsers] = useState<AdminUserView[]>([]);
  const [pendingUsers, setPendingUsers] = useState<AdminUserView[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [adminApiUnavailable, setAdminApiUnavailable] = useState(false);
  const [isNotificationModalOpen, setNotificationModalOpen] = useState(false);
  const [selectedUserForNotif, setSelectedUserForNotif] = useState<AdminUserView | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const companyId = sessionStorage.getItem('activeCompanyId');
        let isAdmin = false;
        
        if (user?.email === SUPER_ADMIN_EMAIL) {
            isAdmin = true;
        }

        if (user && companyId) {
            const companyDataString = sessionStorage.getItem(`company_${companyId}`);
            if (companyDataString) {
                const companyData = JSON.parse(companyDataString) as Company;
                if (companyData.cnpj.replace(/\D/g, '') === ADMIN_COMPANY_CNPJ) {
                    isAdmin = true;
                }
            }
        }

        setHasAdminAccess(isAdmin);
        setLoading(false);

        if (!user) {
          router.push('/login');
          return;
        }

        if (!isAdmin) {
            toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Esta área é restrita a administradores.' });
            router.push('/dashboard');
        }
    }
  }, [user, router, toast]);

  const fetchUsers = useCallback(async () => {
    if (!hasAdminAccess) {
        setLoadingUsers(false);
        return;
    }
    setLoadingUsers(true);
    setAdminApiUnavailable(false);
    try {
        const functions = getFunctions();
        const listUsersFunction = httpsCallable(functions, 'listUsers');
        const authResult = await listUsersFunction();
        const authUsers = authResult.data as { uid: string; email?: string; disabled: boolean; metadata: { creationTime: string; lastSignInTime: string; } }[];

        const usersCollectionRef = collection(db, 'users');
        const firestoreSnap = await getDocs(usersCollectionRef);
        const firestoreUsers = new Map<string, AppUser>();
        firestoreSnap.forEach(doc => {
            firestoreUsers.set(doc.id, { uid: doc.id, ...doc.data() } as AppUser);
        });
        
        const combinedUsers: AdminUserView[] = authUsers.map(authUser => {
            const firestoreUser = firestoreUsers.get(authUser.uid);
            return {
                uid: authUser.uid,
                email: authUser.email,
                disabled: authUser.disabled,
                creationTime: authUser.metadata.creationTime,
                lastSignInTime: authUser.metadata.lastSignInTime,
                licenseType: firestoreUser?.licenseType || 'pending_approval',
            };
        });
        
        const pending = combinedUsers.filter(u => u.licenseType === 'pending_approval');
        const others = combinedUsers.filter(u => u.licenseType !== 'pending_approval');

        setPendingUsers(pending);
        setAllUsers(others);

    } catch (error: any) {
        console.error("Error fetching users: ", error);
        if (error.code === 'functions/unavailable' || error.code === 'permission-denied') {
            setAdminApiUnavailable(true);
             toast({ variant: "destructive", title: "Erro de Permissão", description: "O serviço de administração não está disponível ou você não tem permissão." });
            setAllUsers([]);
            setPendingUsers([]);
        } else {
             toast({ variant: "destructive", title: "Erro ao buscar usuários", description: error.message || 'Ocorreu um erro desconhecido.' });
        }
    } finally {
        setLoadingUsers(false);
    }
  }, [hasAdminAccess, toast]);

  useEffect(() => {
    if(hasAdminAccess) {
        fetchUsers();
    }
  }, [hasAdminAccess, fetchUsers]);

  const updateUserLicense = async (userId: string, licenseType: AppUser['licenseType']) => {
    const userRef = doc(db, 'users', userId);
    try {
        await updateDoc(userRef, { licenseType });
        toast({ title: `Licença do usuário atualizada para ${licenseType}!` });
        fetchUsers();
    } catch(error) {
        toast({ variant: 'destructive', title: 'Erro ao atualizar licença.' });
    }
  }
  
  const toggleUserStatus = async (userId: string, isDisabled: boolean) => {
    try {
        const functions = getFunctions();
        const setUserStatusFunction = httpsCallable(functions, 'setUserStatus');
        await setUserStatusFunction({ uid: userId, disabled: !isDisabled });
        toast({ title: `Status do usuário atualizado!` });
        fetchUsers();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro ao atualizar status do usuário.', description: error.message });
    }
  }
  
  const handleOpenNotificationModal = (user: AdminUserView) => {
      setSelectedUserForNotif(user);
      setNotificationModalOpen(true);
  };

  const getLicenseVariant = (license?: AppUser['licenseType']): "secondary" | "default" | "success" | "outline" | "destructive" => {
      switch(license) {
          case 'basica': return 'secondary';
          case 'profissional': return 'default';
          case 'premium': return 'success';
          case 'pending_approval': return 'destructive';
          default: return 'outline';
      }
  }

  const getLicenseLabel = (license?: AppUser['licenseType']) => {
      switch(license) {
          case 'basica': return 'Básica';
          case 'profissional': return 'Profissional';
          case 'premium': return 'Premium';
          case 'pending_approval': return 'Aguardando Liberação';
          default: return 'Avaliação';
      }
  }

  const formatUserDate = (dateString: string) => {
      if (!dateString) return 'N/A';
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
  };

  if (loading || !hasAdminAccess) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel de Administração</h1>
        <Button variant="outline" onClick={fetchUsers} disabled={loadingUsers}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loadingUsers && "animate-spin")} />
            Atualizar Lista
        </Button>
      </div>

       <Card>
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <UserPlus className="text-amber-500"/>
                Aprovações Pendentes
            </CardTitle>
            <CardDescription>Usuários aguardando liberação para acessar o sistema.</CardDescription>
            </CardHeader>
            <CardContent>
                {loadingUsers ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div> : pendingUsers.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Nenhum usuário aguardando aprovação.</div>
                ) : (
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Data de Criação</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingUsers.map((appUser) => (
                            <TableRow key={appUser.uid}>
                                <TableCell className="font-medium">{appUser.email}</TableCell>
                                <TableCell>{formatUserDate(appUser.creationTime)}</TableCell>
                                <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Menu</span><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger><ShieldCheck className="mr-2 h-4 w-4 text-green-500" /><span>Aprovar e Liberar Licença</span></DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent>
                                                <DropdownMenuItem onClick={() => updateUserLicense(appUser.uid, 'basica')}><CheckCircle className="mr-2 h-4 w-4 text-gray-500" /> Básica</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => updateUserLicense(appUser.uid, 'profissional')}><Star className="mr-2 h-4 w-4 text-yellow-500" /> Profissional</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => updateUserLicense(appUser.uid, 'premium')}><Sparkles className="mr-2 h-4 w-4 text-blue-500" /> Premium</DropdownMenuItem>
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                        <DropdownMenuItem onClick={() => toggleUserStatus(appUser.uid, appUser.disabled)} className="text-destructive"><UserX className="mr-2 h-4 w-4" /><span>Negar e Desativar</span></DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>

      <Card>
        <CardHeader>
            <CardTitle>Gerenciamento de Usuários e Licenças</CardTitle>
            <CardDescription>Visualize e gerencie os usuários cadastrados no sistema.</CardDescription>
        </CardHeader>
        <CardContent>
            {loadingUsers ? (
                <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : adminApiUnavailable ? (
                 <div className="flex flex-col items-center justify-center py-20 text-center">
                    <AlertCircle className="w-16 h-16 text-destructive mb-4" />
                    <h2 className="text-2xl font-bold">Serviço de Admin Indisponível</h2>
                    <p className="text-muted-foreground mt-2">Não foi possível carregar a lista de usuários. Verifique as permissões do seu projeto ou tente novamente mais tarde.</p>
                </div>
            ) : allUsers.length === 0 ? (
                <div className="text-center text-muted-foreground py-20">Nenhum usuário aprovado encontrado.</div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Último Login</TableHead>
                            <TableHead>Licença</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allUsers.map((appUser) => (
                            <TableRow key={appUser.uid}>
                                <TableCell className="font-medium">{appUser.email}</TableCell>
                                <TableCell>{formatUserDate(appUser.lastSignInTime)}</TableCell>
                                <TableCell><Badge variant={getLicenseVariant(appUser.licenseType)}>{getLicenseLabel(appUser.licenseType)}</Badge></TableCell>
                                <TableCell><Badge variant={appUser.disabled ? 'destructive' : 'success'}>{appUser.disabled ? 'Desativado' : 'Ativo'}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0" disabled={appUser.email === SUPER_ADMIN_EMAIL}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleOpenNotificationModal(appUser)}><MessageSquare className="mr-2 h-4 w-4"/> Enviar Notificação</DropdownMenuItem>
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger><ShieldCheck className="mr-2 h-4 w-4"/>Alterar Licença</DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent>
                                                    <DropdownMenuItem onClick={() => updateUserLicense(appUser.uid, 'basica')}>Básica</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => updateUserLicense(appUser.uid, 'profissional')}>Profissional</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => updateUserLicense(appUser.uid, 'premium')}>Premium</DropdownMenuItem>
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                            <DropdownMenuItem onClick={() => toggleUserStatus(appUser.uid, appUser.disabled)}>{appUser.disabled ? <UserCheck className="mr-2 h-4 w-4"/> : <UserX className="mr-2 h-4 w-4"/>}{appUser.disabled ? 'Reativar Usuário' : 'Desativar Usuário'}</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
      
        {selectedUserForNotif && (
            <NotificationFormModal 
            isOpen={isNotificationModalOpen}
            onClose={() => setNotificationModalOpen(false)}
            targetUser={selectedUserForNotif}
            />
        )}
    </div>
  );
}
