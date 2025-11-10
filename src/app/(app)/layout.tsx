

"use client";

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/lib/auth';
import { db, FirebaseProvider } from '@/lib/firebase.tsx';
import { CompanySelectionModal } from '@/components/company-selection-modal';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { HelpModal } from '@/components/layout/help-modal';
import type { AppUser } from '@/types/user';
import { checkDeadlines } from '@/services/deadline-check-service';

const SUPER_ADMIN_EMAIL = 'geovaniwn@gmail.com';

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  
  const [isCompanyModalOpen, setCompanyModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [activeCompany, setActiveCompany] = useState<any>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const isDashboard = pathname === '/dashboard';

  useEffect(() => {
    // 1. Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // 2. If no user, redirect to login
    if (!user) {
      router.replace('/login');
      return;
    }

    // 3. If user exists, load their app data
    const loadAppData = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        let userSnap = await getDoc(userRef);
        let userData: AppUser;

        // 3a. If user document doesn't exist, create it as a fallback.
        if (!userSnap.exists()) {
          toast({
            variant: "destructive",
            title: "Corrigindo perfil...",
            description: "Seu perfil de usuário não foi encontrado, criando um novo registro."
          });
          
          const isAdmin = user.email === SUPER_ADMIN_EMAIL;
          const licenseType = isAdmin ? 'premium' : 'pending_approval';

          const newUserDoc: Omit<AppUser, 'uid'> = {
            email: user.email!,
            createdAt: serverTimestamp(),
            licenseType: licenseType,
          };
          await setDoc(userRef, newUserDoc);
          userSnap = await getDoc(userRef); // Re-fetch the document
          if (!userSnap.exists()) {
            throw new Error("Falha ao criar e buscar o documento do usuário.");
          }
        }
        
        userData = { uid: user.uid, ...userSnap.data() } as AppUser;
        setAppUser(userData);

        // 4. Check license and redirect if pending (unless it's the super admin)
        if (userData.licenseType === 'pending_approval' && user.email !== SUPER_ADMIN_EMAIL) {
          router.replace('/pending-approval');
          return;
        }

        // 5. Load company data
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (companyId) {
          const companyRef = doc(db, `users/${user.uid}/companies`, companyId);
          const docSnap = await getDoc(companyRef);
          if (docSnap.exists()) {
            const companyData = { id: docSnap.id, ...docSnap.data() };
            setActiveCompany(companyData);
            sessionStorage.setItem(`company_${companyData.id}`, JSON.stringify(companyData));

            // 6. Check for deadlines once company is loaded
            checkDeadlines(user.uid, companyId);
          } else {
            sessionStorage.removeItem('activeCompanyId');
            setCompanyModalOpen(true);
          }
        } else {
          setCompanyModalOpen(true);
        }

      } catch (err) {
        console.error("Error loading user/company data:", err);
        toast({
          variant: "destructive",
          title: "Erro Crítico de Usuário",
          description: "Não foi possível carregar ou criar seus dados. Redirecionando para o login.",
        });
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };
    
    loadAppData();

  }, [user, authLoading, router, toast]);

  const handleCompanySelect = (company: any) => {
    sessionStorage.setItem('activeCompanyId', company.id);
    setActiveCompany(company);
    setCompanyModalOpen(false);
    toast({
        title: `Empresa alterada para: ${company.nomeFantasia}`,
        description: "A página será recarregada para atualizar os dados.",
    });
    setTimeout(() => window.location.reload(), 1500);
  };
  
  if (authLoading || loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // This check prevents flashing the main layout for users who will be redirected.
  if (!appUser || (appUser.licenseType === 'pending_approval' && user?.email !== SUPER_ADMIN_EMAIL)) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
      <FirebaseProvider>
        <div className="flex min-h-screen w-full">
          {!isDashboard && <SidebarNav onHelpClick={() => setIsHelpModalOpen(true)} />}
          <div className="flex flex-1 flex-col">
            <Header
              activeCompany={activeCompany}
              onSwitchCompany={() => setCompanyModalOpen(true)}
            />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="mx-auto w-full max-w-none">
                {children}
              </div>
            </main>
          </div>
          {user && (
            <CompanySelectionModal
              isOpen={isCompanyModalOpen}
              onClose={() => {
                if (activeCompany) {
                  setCompanyModalOpen(false);
                } else {
                  toast({
                    variant: "destructive",
                    title: "Seleção de empresa necessária",
                    description: "Você precisa selecionar uma empresa para continuar.",
                  })
                }
              }}
              onCompanySelect={handleCompanySelect}
              userId={user.uid}
            />
          )}
          <HelpModal 
            isOpen={isHelpModalOpen} 
            onClose={() => setIsHelpModalOpen(false)}
            activeCompany={activeCompany}
          />
        </div>
      </FirebaseProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppLayoutContent>{children}</AppLayoutContent>
        </SidebarProvider>
    )
}
