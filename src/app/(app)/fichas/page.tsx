
"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, CalendarCheck, FileX, Users2 } from "lucide-react";
import type { Employee } from '@/types/employee';
import type { Company } from '@/types/company';
import { useAuth } from '@/lib/auth';
import { EmployeeSelectionModal } from '@/components/pessoal/employee-selection-modal';
import { generateContractPdf } from '@/services/contract-service';
import { useToast } from '@/hooks/use-toast';
import { generateVacationNoticePdf } from '@/services/vacation-notice-service';
import { generateTrctPdf } from '@/services/trct-service';
import { collection, doc, getDoc, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Vacation } from '@/types/vacation';
import { Timestamp } from 'firebase/firestore';
import { generateDependentsListPdf } from '@/services/dependents-list-service';
import { useRouter } from 'next/navigation';
import { VacationDateModal } from '@/components/pessoal/vacation-date-modal';
import { calculateVacation } from '@/services/vacation-service';


type DocumentType = 'contract' | 'vacation' | 'termination' | 'dependents';

export default function FichasPage() {
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [isVacationDateModalOpen, setVacationDateModalOpen] = useState(false);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [documentType, setDocumentType] = useState<DocumentType | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const companyId = sessionStorage.getItem('activeCompanyId');
            if (user && companyId) {
                const companyDataString = sessionStorage.getItem(`company_${companyId}`);
                if (companyDataString) {
                    setActiveCompany(JSON.parse(companyDataString));
                }
            }
        }
    }, [user]);

    const handleOpenModal = (type: DocumentType) => {
        setDocumentType(type);
        setIsEmployeeModalOpen(true);
    };

    const handleSelectEmployee = async (employee: Employee) => {
        if (!activeCompany || !documentType || !user) {
            toast({ variant: 'destructive', title: 'Erro inesperado. Tente novamente.'});
            return;
        }

        setIsEmployeeModalOpen(false);
        setSelectedEmployee(employee);

        try {
            switch (documentType) {
                case 'contract':
                    generateContractPdf(activeCompany, employee);
                    break;
                case 'vacation':
                    setVacationDateModalOpen(true);
                    break;
                case 'termination': {
                    const termRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/terminations`);
                    const q = query(
                        termRef,
                        where("employeeId", "==", employee.id!)
                    );
                    const termSnap = await getDocs(q);
                    
                    if (termSnap.empty) {
                        toast({ variant: "destructive", title: "Cálculo de Rescisão não encontrado", description: "Redirecionando para a tela de cálculo para que você possa gerar a rescisão." });
                         router.push(`/pessoal/rescisao?employeeId=${employee.id}`);
                        return;
                    }
                    
                    const sortedTerminations = termSnap.docs.sort((a, b) => {
                        const dateA = (a.data().createdAt as Timestamp)?.toDate() || new Date(0);
                        const dateB = (b.data().createdAt as Timestamp)?.toDate() || new Date(0);
                        return dateB.getTime() - dateA.getTime();
                    });

                    const latestTermDoc = sortedTerminations[0];
                    const termData = latestTermDoc.data() as Termination;
                    termData.terminationDate = (termData.terminationDate as Timestamp).toDate();
                    generateTrctPdf(activeCompany, employee, termData);
                    break;
                }
                 case 'dependents':
                    generateDependentsListPdf(activeCompany, employee);
                    break;
            }
        } catch (error) {
            console.error(`Erro ao gerar documento ${documentType}:`, error);
            toast({ variant: "destructive", title: `Erro ao gerar ${documentType}`, description: "Verifique o console para mais detalhes."});
        }
    };
    
    const handleVacationDateSubmit = async (startDate: Date) => {
        if (!selectedEmployee || !user || !activeCompany) return;

        setVacationDateModalOpen(false);

        try {
            const result = calculateVacation({
                employee: selectedEmployee,
                startDate,
                vacationDays: 30, // Default to 30, can be made configurable later
                sellVacation: false,
                advanceThirteenth: false,
            });

            const vacationData: Omit<Vacation, 'id' | 'createdAt'> = {
                employeeId: selectedEmployee.id!,
                employeeName: selectedEmployee.nomeCompleto,
                startDate,
                vacationDays: 30,
                sellVacation: false,
                advanceThirteenth: false,
                result: result,
                updatedAt: serverTimestamp(),
            };
            
            // Save the new calculation
            const vacationsRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/vacations`);
            await addDoc(vacationsRef, { ...vacationData, createdAt: serverTimestamp() });
            
            toast({ title: "Cálculo de férias salvo com sucesso!" });

            // Generate the PDF with the new data
            generateVacationNoticePdf(activeCompany, selectedEmployee, vacationData as Vacation);

        } catch (error) {
             console.error("Erro ao calcular e gerar aviso de férias:", error);
            toast({ variant: "destructive", title: "Erro ao Processar Férias", description: (error as Error).message });
        } finally {
            setSelectedEmployee(null); // Reset selected employee
        }
    };

    const documentCards = [
        { 
            type: 'contract' as DocumentType,
            title: 'Contrato de Trabalho',
            description: 'Gere o contrato individual de trabalho para um novo funcionário.',
            icon: FileText
        },
        { 
            type: 'vacation' as DocumentType,
            title: 'Aviso de Férias',
            description: 'Gere o aviso de férias para um funcionário com férias calculadas.',
            icon: CalendarCheck
        },
        { 
            type: 'termination' as DocumentType,
            title: 'Termo de Rescisão (TRCT)',
            description: 'Gere o Termo de Rescisão de Contrato de Trabalho para um funcionário desligado.',
            icon: FileX
        },
        { 
            type: 'dependents' as DocumentType,
            title: 'Relação de Dependentes',
            description: 'Gere um documento com a lista de todos os dependentes de um funcionário.',
            icon: Users2
        }
    ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Central de Documentos</h1>
      </div>
        <Card>
            <CardHeader>
                <CardTitle>Documentos do Departamento Pessoal</CardTitle>
                <CardDescription>Selecione um documento abaixo para gerar. A maioria dos documentos requer a seleção de um funcionário.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {documentCards.map((card) => (
                        <Card key={card.type} className="flex flex-col">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-muted rounded-md">
                                        <card.icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <CardTitle className="text-lg">{card.title}</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-sm text-muted-foreground">{card.description}</p>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" onClick={() => handleOpenModal(card.type)} disabled={!activeCompany}>
                                    Gerar Documento
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
                 {!activeCompany && (
                    <div className="text-center py-6 text-sm text-destructive">
                        Selecione uma empresa para habilitar a geração de documentos.
                    </div>
                )}
            </CardContent>
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
      
      <VacationDateModal 
        isOpen={isVacationDateModalOpen}
        onClose={() => setVacationDateModalOpen(false)}
        onSubmit={handleVacationDateSubmit}
      />
    </div>
  );
}
