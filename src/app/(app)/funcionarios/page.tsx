
"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, UserCog } from "lucide-react";
import { EmployeeFormModal } from '@/components/pessoal/employee-form-modal';
import { useAuth } from '@/lib/auth';

export default function FuncionariosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cadastro de Funcionários</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo Funcionário
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Funcionários Cadastrados</CardTitle>
          <CardDescription>Gerencie os funcionários da empresa.</CardDescription>
        </CardHeader>
         <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
                <UserCog className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Nenhum funcionário cadastrado</h3>
            <p className="text-muted-foreground mt-2">Clique em "Novo Funcionário" para começar.</p>
        </div>
      </Card>
      
      {user && (
         <EmployeeFormModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            userId={user.uid}
          />
      )}
    </div>
  );
}
