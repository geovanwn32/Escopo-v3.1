
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MoreHorizontal, CheckCircle, RefreshCw, XCircle, ShieldCheck, Star, Sparkles } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import type { Company } from '@/types/company';
import type { AppUser } from '@/types/user';

const ADMIN_COMPANY_CNPJ = '00000000000000';

export default function AdminPage() {
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (user && companyId) {
            const companyDataString = sessionStorage.getItem(`company_${companyId}`);
            if (companyDataString) {
                const companyData = JSON.parse(companyDataString);
                setActiveCompany(companyData);
                if (companyData.cnpj !== ADMIN_COMPANY_CNPJ) {
                    toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Esta área é restrita a administradores.' });
                    router.push('/dashboard');
                }
            } else {
                 router.push('/dashboard');
            }
        } else if (!user) {
            router.push('/login');
        } else {
             router.push('/dashboard');
        }
    }
  }, [user, router, toast]);

  useEffect(() => {
    if (!activeCompany || activeCompany.cnpj !== ADMIN_COMPANY_CNPJ) {
        setLoading(false);
        return;
    }

    const usersRef = collection(db, `users`);
    const q = query(usersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const usersData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                uid: doc.id,
                trialEndsAt: data.trialEndsAt?.toDate(),
            } as AppUser;
        });
        setUsersList(usersData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching users: ", error);
        toast({
            variant: "destructive",
            title: "Erro ao buscar usuários",
        });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [activeCompany, toast]);
  
  const updateUserLicense = async (userId: string, licenseType: AppUser['licenseType']) => {
    const userRef = doc(db, 'users', userId);
    try {
        await updateDoc(userRef, { licenseType });
        toast({ title: `Licença do usuário atualizada para ${licenseType}!` });
    } catch(error) {
        toast({ variant: 'destructive', title: 'Erro ao atualizar licença.' });
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

  if (loading || !activeCompany || activeCompany.cnpj !== ADMIN_COMPANY_CNPJ) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Painel de Administração - Usuários</h1>
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Fim da Avaliação</TableHead>
                  <TableHead>Tipo de Licença</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersList.map((appUser) => (
                  <TableRow key={appUser.uid}>
                    <TableCell className="font-medium">{appUser.email}</TableCell>
                    <TableCell>{appUser.trialEndsAt ? format(appUser.trialEndsAt as Date, 'dd/MM/yyyy') : 'N/A'}</TableCell>
                    <TableCell>
                        <Badge variant={getLicenseVariant(appUser.licenseType)}>
                            {getLicenseLabel(appUser.licenseType)}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
