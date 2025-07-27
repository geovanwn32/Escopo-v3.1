
"use client";

import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MoreHorizontal, CheckCircle, RefreshCw, XCircle, ShieldCheck, Star, Sparkles, UserX, UserCheck, AlertCircle } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import type { Company } from '@/types/company';
import type { AppUser } from '@/types/user';
import { getFunctions, httpsCallable } from 'firebase/functions';

const ADMIN_COMPANY_CNPJ = '00000000000000';
const SUPER_ADMIN_EMAIL = 'geovaniwn@gmail.com';

interface AdminUserView {
    uid: string;
    email?: string;
    disabled: boolean;
    creationTime: string;
    lastSignInTime: string;
    licenseType: AppUser['licenseType'];
    trialEndsAt?: { _seconds: number, _nanoseconds: number } | Date;
}

export default function AdminPage() {
  const [usersList, setUsersList] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [adminApiUnavailable, setAdminApiUnavailable] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const companyId = sessionStorage.getItem('activeCompanyId');
        let isAdmin = false;
        
        // Super admin check
        if (user?.email === SUPER_ADMIN_EMAIL) {
            isAdmin = true;
        }

        if (user && companyId) {
            const companyDataString = sessionStorage.getItem(`company_${companyId}`);
            if (companyDataString) {
                const companyData = JSON.parse(companyDataString);
                setActiveCompany(companyData);
                if (companyData.cnpj === ADMIN_COMPANY_CNPJ) {
                    isAdmin = true;
                }
            }
        }

        setHasAdminAccess(isAdmin);

        if (!user) {
          router.push('/login');
          return;
        }

        if (!isAdmin && user?.email !== SUPER_ADMIN_EMAIL) {
            toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Esta área é restrita a administradores.' });
            router.push('/dashboard');
        }
    }
  }, [user, router, toast]);

    const fetchUsers = async () => {
        if (!hasAdminAccess) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setAdminApiUnavailable(false);
        try {
            const functions = getFunctions();
            const listUsersFunction = httpsCallable(functions, 'listUsers');
            const result = await listUsersFunction();
            const data = result.data as AdminUserView[];
            setUsersList(data);
        } catch (error: any) {
            console.error("Error fetching users via callable function: ", error);
            if (error.code === 'functions/unavailable' || error.code === 'permission-denied') {
                setAdminApiUnavailable(true);
                setUsersList([]);
            } else {
                 toast({ variant: "destructive", title: "Erro ao buscar usuários", description: error.message || 'Ocorreu um erro desconhecido.' });
            }
        } finally {
            setLoading(false);
        }
    };

  useEffect(() => {
    if(hasAdminAccess) {
        fetchUsers();
    } else {
        setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAdminAccess]);
  
  const updateUserLicense = async (userId: string, licenseType: AppUser['licenseType']) => {
    const userRef = doc(db, 'users', userId);
    try {
        await updateDoc(userRef, { licenseType });
        toast({ title: `Licença do usuário atualizada para ${licenseType}!` });
        setUsersList(prev => prev.map(u => u.uid === userId ? { ...u, licenseType } : u));
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
        setUsersList(prev => prev.map(u => u.uid === userId ? { ...u, disabled: !isDisabled } : u));
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro ao atualizar status do usuário.', description: error.message });
    }
  }

  const getLicenseVariant = (license?: AppUser['licenseType']): "secondary" | "default" | "success" | "outline" | "destructive" => {
    switch(license) {
        case 'basica': return 'secondary';
        case 'profissional': return 'default';
        case 'premium': return 'success';
        case 'trial':
        default: return 'outline';
    }
  }

  const getLicenseLabel = (license?: AppUser['licenseType']) => {
     switch(license) {
        case 'basica': return 'Básica';
        case 'profissional': return 'Profissional';
        case 'premium': return 'Premium';
        case 'trial':
        default: return 'Avaliação';
    }
  }

  const formatUserDate = (dateString: string) => {
      if (!dateString) return 'N/A';
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!hasAdminAccess) {
      return <div className="flex h-screen items-center justify-center"><p>Acesso negado.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel de Administração - Usuários</h1>
        <Button onClick={fetchUsers} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Lista
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Usuários e Licenças</CardTitle>
          <CardDescription>Visualize e gerencie os usuários cadastrados no sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : adminApiUnavailable ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 text-amber-500" />
                <h3 className="text-xl font-semibold text-foreground">Serviço de Admin Indisponível</h3>
                <p className="mt-2 max-w-md">O serviço de administração pode estar indisponível neste ambiente (ex: desenvolvimento local) ou você não tem permissão para acessá-lo.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Último Login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo de Licença</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersList.map((appUser) => (
                  <TableRow key={appUser.uid}>
                    <TableCell className="font-medium">{appUser.email}</TableCell>
                    <TableCell>{formatUserDate(appUser.creationTime)}</TableCell>
                    <TableCell>{formatUserDate(appUser.lastSignInTime)}</TableCell>
                    <TableCell>
                        <Badge variant={appUser.disabled ? 'destructive' : 'success'}>
                            {appUser.disabled ? 'Desativado' : 'Ativo'}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <Badge variant={getLicenseVariant(appUser.licenseType)}>
                            {getLicenseLabel(appUser.licenseType)}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={appUser.email === SUPER_ADMIN_EMAIL}>
                                <span className="sr-only">Menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {appUser.disabled ? (
                                <DropdownMenuItem onClick={() => toggleUserStatus(appUser.uid, appUser.disabled)}>
                                    <UserCheck className="mr-2 h-4 w-4 text-green-500" />
                                    <span>Reativar Usuário</span>
                                </DropdownMenuItem>
                            ) : (
                                 <DropdownMenuItem onClick={() => toggleUserStatus(appUser.uid, appUser.disabled)} className="text-destructive">
                                    <UserX className="mr-2 h-4 w-4" />
                                    <span>Desativar Usuário</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                    <span>Alterar Licença</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem onClick={() => updateUserLicense(appUser.uid, 'trial')}>
                                        <XCircle className="mr-2 h-4 w-4 text-muted-foreground" /> Avaliação
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateUserLicense(appUser.uid, 'basica')}>
                                        <CheckCircle className="mr-2 h-4 w-4 text-gray-500" /> Básica
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateUserLicense(appUser.uid, 'profissional')}>
                                        <Star className="mr-2 h-4 w-4 text-yellow-500" /> Profissional
                                    </DropdownMenuItem>
                                     <DropdownMenuItem onClick={() => updateUserLicense(appUser.uid, 'premium')}>
                                        <Sparkles className="mr-2 h-4 w-4 text-blue-500" /> Premium
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
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
    </div>
  );
}
