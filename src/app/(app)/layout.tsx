
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { CompanySelectionModal } from '@/components/company-selection-modal';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { HelpModal } from '@/components/layout/help-modal';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/user';


function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isCompanyModalOpen, setCompanyModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [activeCompany, setActiveCompany] = useState<any>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const { open } = useSidebar();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    const loadAppData = async () => {
        // Fetch user data from Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            setAppUser(userSnap.data() as AppUser);
        }

        // Fetch company data from session
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (companyId) {
          const companyRef = doc(db, `users/${user.uid}/companies`, companyId);
          const docSnap = await getDoc(companyRef);
          if (docSnap.exists()) {
            const companyData = { id: docSnap.id, ...docSnap.data() };
            setActiveCompany(companyData);
            sessionStorage.setItem(`company_${companyData.id}`, JSON.stringify(companyData));
          } else {
            sessionStorage.removeItem('activeCompanyId');
            setCompanyModalOpen(true);
          }
        } else {
          setCompanyModalOpen(true);
        }
        setLoading(false);
    }
    
    loadAppData();

  }, [user, authLoading, router]);

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
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
      <div className="flex min-h-screen w-full bg-neutral-100 dark:bg-neutral-800">
        <SidebarNav activeCompany={activeCompany} onHelpClick={() => setIsHelpModalOpen(true)} />
        <div className={cn(
          "flex flex-1 flex-col overflow-hidden transition-[padding-left] duration-300 ease-in-out",
          open ? "md:pl-64" : "md:pl-[60px]"
        )}>
          <Header
            activeCompany={activeCompany}
            onSwitchCompany={() => setCompanyModalOpen(true)}
          />
          <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
            {children}
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
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppLayoutContent>{children}</AppLayoutContent>
        </SidebarProvider>
    )
}
