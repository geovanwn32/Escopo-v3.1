
"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { Company } from '@/types/company';

const ADMIN_COMPANY_CNPJ = '00000000000000';
const SUPER_ADMIN_EMAIL = 'geovaniwn@gmail.com';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

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


  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!hasAdminAccess) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold">Acesso Negado</h2>
            <p className="text-muted-foreground mt-2">Esta página é restrita a administradores.</p>
            <Button onClick={() => router.push('/dashboard')} className="mt-6">Voltar ao Dashboard</Button>
        </div>
      )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel de Administração</h1>
      </div>
      
       <Card>
          <CardHeader>
            <CardTitle>Painel de Administração</CardTitle>
            <CardDescription>O gerenciamento de usuários foi movido para a página "Minha Empresa" para administradores.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Para visualizar e aprovar usuários, por favor, acesse a página "Minha Empresa" enquanto estiver logado com sua conta de administrador ou com a empresa de administração selecionada.</p>
            <Button onClick={() => router.push('/minha-empresa')} className="mt-4">
              Ir para Minha Empresa
            </Button>
          </CardContent>
      </Card>
    </div>
  );
}

    