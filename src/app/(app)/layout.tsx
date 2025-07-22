
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { CompanySelectionModal } from '@/components/company-selection-modal';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { HelpModal } from '@/components/layout/help-modal';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isCompanyModalOpen, setCompanyModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [activeCompany, setActiveCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else {
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (companyId) {
          const companyRef = doc(db, `users/${user.uid}/companies`, companyId);
          getDoc(companyRef).then(docSnap => {
            if (docSnap.exists()) {
              const companyData = { id: docSnap.id, ...docSnap.data() };
              setActiveCompany(companyData);
              // Store company data in session storage for other components to access
              sessionStorage.setItem(`company_${companyData.id}`, JSON.stringify(companyData));
              setLoading(false);
            } else {
              sessionStorage.removeItem('activeCompanyId');
              setCompanyModalOpen(true);
              setLoading(false);
            }
          });
        } else {
          setCompanyModalOpen(true);
          setLoading(false);
        }
      }
    }
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-neutral-100 dark:bg-neutral-800">
        <SidebarNav activeCompany={activeCompany} onHelpClick={() => setIsHelpModalOpen(true)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            activeCompany={activeCompany}
            onSwitchCompany={() => setCompanyModalOpen(true)}
          />
          <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
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
    </SidebarProvider>
  );
}
