
"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, BookUser } from "lucide-react";
import type { Employee } from '@/types/employee';
import type { Company } from '@/types/company';
import { useAuth } from '@/lib/auth';
import { EmployeeSelectionModal } from '@/components/pessoal/employee-selection-modal';
import { generateContractPdf } from '@/services/contract-service';
import { useToast } from '@/hooks/use-toast';


export default function FichasPage() {
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();

    useState(() => {
        if (typeof window !== 'undefined') {
            const companyId = sessionStorage.getItem('activeCompanyId');
            if (user && companyId) {
                const companyDataString = sessionStorage.getItem(`company_${companyId}`);
                if (companyDataString) {
                    setActiveCompany(JSON.parse(companyDataString));
                }
            }
        }
    });

    const handleSelectEmployee = (employee: Employee) => {
        if (!activeCompany) {
            toast({ variant: 'destructive', title: 'Nenhuma empresa ativa selecionada.'});
            return;
        }
        setIsEmployeeModalOpen(false);
        generateContractPdf(activeCompany, employee);
    };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Geração de Documentos</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Documentos e Contratos</CardTitle>
          <CardDescription>Gere documentos importantes do departamento pessoal.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button onClick={() => setIsEmployeeModalOpen(true)} disabled={!activeCompany}>
                <FileText className="mr-2 h-4 w-4" />
                Gerar Contrato de Trabalho
            </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Fichas Cadastradas</CardTitle>
          <CardDescription>Gerencie as fichas aqui.</CardDescription>
        </CardHeader>
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
                <BookUser className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Nenhuma ficha cadastrada</h3>
            <p className="text-muted-foreground mt-2">Esta área será implementada no futuro.</p>
        </div>
      </Card>

      {user && activeCompany && (
        <EmployeeSelectionModal
            isOpen={isEmployeeModalOpen}
            onClose={() => setIsEmployeeModalOpen(false)}
            onSelect={handleSelectEmployee}
            userId={user.uid}
            companyId={activeCompany.id}
        />
      )}
    </div>
  );
}
