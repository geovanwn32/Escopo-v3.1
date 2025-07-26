
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Company } from "@/types/company";
import { ArrowLeft, FileText, Calculator } from "lucide-react";
import Link from "next/link";

export default function CalculoInventarioPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);

    const [entradas, setEntradas] = useState(0);
    const [saidas, setSaidas] = useState(0);
    const [iva, setIva] = useState(0);
    const [inventarioAnterior, setInventarioAnterior] = useState(0);
    const [saidasMenosIva, setSaidasMenosIva] = useState(0);
    const [inventarioAtual, setInventarioAtual] = useState(0);

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

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const parseCurrency = (value: string): number => {
        return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
    };
    
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<number>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(parseCurrency(e.target.value));
    };

    const calculateValues = () => {
        const saidasIvaResult = saidas - (saidas * iva / 100);
        setSaidasMenosIva(saidasIvaResult);

        const inventarioAtualResult = entradas + inventarioAnterior - saidasIvaResult;
        setInventarioAtual(inventarioAtualResult);
        toast({ title: "Valores Recalculados!", description: "O inventário atual foi atualizado." });
    };

    const generatePDF = () => {
        if (!activeCompany) {
            toast({ variant: 'destructive', title: 'Nenhuma empresa selecionada.' });
            return;
        }

        const { jsPDF } = window as any;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text("CÁLCULO DE INVENTÁRIO", 105, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Empresa: ${activeCompany.nomeFantasia}`, 10, 25);
        doc.text(`CNPJ: ${activeCompany.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`, 10, 32);

        const data = [
            ["ENTRADAS", `R$ ${formatCurrency(entradas)}`],
            ["SAÍDAS", `R$ ${formatCurrency(saidas)}`],
            ["IVA", `${iva.toFixed(2).replace('.', ',')}%`],
            ["SAÍDAS - IVA", `-R$ ${formatCurrency(saidasMenosIva)}`],
            ["INVENTÁRIO ANTERIOR", `R$ ${formatCurrency(inventarioAnterior)}`],
            ["INVENTÁRIO ATUAL", `R$ ${formatCurrency(inventarioAtual)}`],
        ];

        let startY = 50;
        doc.setFont('helvetica', 'bold');
        doc.text("Descrição", 14, startY);
        doc.text("Valor", 150, startY, { align: 'right' });
        doc.line(14, startY + 2, 196, startY + 2);
        startY += 8;

        doc.setFont('helvetica', 'normal');
        data.forEach(row => {
            doc.text(row[0], 14, startY);
            doc.text(row[1], 196, startY, { align: 'right' });
            startY += 7;
        });

        doc.save("calculo_inventario.pdf");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/fiscal">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Voltar</span>
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Calculadora de Inventário</h1>
            </div>
            
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>Cálculo de Inventário Simples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="entradas">Entradas (R$)</Label>
                            <Input id="entradas" value={formatCurrency(entradas)} onChange={handleInputChange(setEntradas)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="saidas">Saídas (R$)</Label>
                            <Input id="saidas" value={formatCurrency(saidas)} onChange={handleInputChange(setSaidas)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="iva">IVA (%)</Label>
                            <Input id="iva" value={iva} type="number" onChange={(e) => setIva(parseFloat(e.target.value) || 0)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="inventario-anterior">Inventário Anterior (R$)</Label>
                            <Input id="inventario-anterior" value={formatCurrency(inventarioAnterior)} onChange={handleInputChange(setInventarioAnterior)} />
                        </div>
                    </div>
                    <Button onClick={calculateValues} className="w-full">
                        <Calculator className="mr-2 h-4 w-4" /> Calcular Inventário Atual
                    </Button>
                    <div className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="saidas-iva">Saídas - IVA (R$)</Label>
                                <Input id="saidas-iva" value={formatCurrency(saidasMenosIva)} readOnly className="font-semibold" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="inventario-atual" className="text-primary">Inventário Atual (R$)</Label>
                                <Input id="inventario-atual" value={formatCurrency(inventarioAtual)} readOnly className="font-bold text-lg text-primary border-primary" />
                            </div>
                        </div>
                    </div>
                    <Button onClick={generatePDF} variant="secondary" className="w-full mt-4">
                        <FileText className="mr-2 h-4 w-4" /> Gerar Relatório em PDF
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
