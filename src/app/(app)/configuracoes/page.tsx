
"use client"

import { useTheme } from "next-themes";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Laptop } from "lucide-react";

export default function ConfiguracoesPage() {
  const { setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações Gerais</h1>
      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>Personalize a aparência do sistema. Escolha entre os temas claro, escuro ou o padrão do seu sistema operacional.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" />
              Claro
            </Button>
            <Button variant="outline" onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" />
              Escuro
            </Button>
            <Button variant="outline" onClick={() => setTheme("system")}>
              <Laptop className="mr-2 h-4 w-4" />
              Sistema
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
