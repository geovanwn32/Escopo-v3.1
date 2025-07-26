
"use client";

import { useState, useMemo, useRef } from "react";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, File as FileIcon, Trash2, Filter, Calculator, FileDown, Loader2, ListFilter, RotateCcw, ArrowLeft } from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from 'next/link';


interface Product {
    nome: string;
    ncm: string;
    unidade: string;
    qtd: number;
    valorUnit: number;
    valorTotal: number;
    baseICMS: number;
    aliqICMS: number;
    valorICMS: number;
    cfop: string;
}

const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
};

export default function InventarioPage() {
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
    const [cfops, setCfops] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [cfopFilter, setCfopFilter] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsLoading(true);
        let tempProducts: Product[] = [];
        let tempCfops = new Set<string>();

        const fileReadPromises = Array.from(files).map(file => 
            new Promise<void>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const parser = new DOMParser();
                        const xml = parser.parseFromString(e.target?.result as string, "text/xml");
                        const items = xml.querySelectorAll("prod");
                        items.forEach(prod => {
                            const obj: Product = {
                                nome: prod.querySelector("xProd")?.textContent?.trim() || '',
                                ncm: prod.querySelector("NCM")?.textContent?.trim() || '',
                                unidade: prod.querySelector("uCom")?.textContent?.trim() || '',
                                qtd: parseFloat(prod.querySelector("qCom")?.textContent || '0'),
                                valorUnit: parseFloat(prod.querySelector("vUnCom")?.textContent || '0'),
                                valorTotal: parseFloat(prod.querySelector("vProd")?.textContent || '0'),
                                baseICMS: parseFloat(prod.querySelector("vBC")?.textContent || '0'),
                                aliqICMS: parseFloat(prod.querySelector("pICMS")?.textContent || '0'),
                                valorICMS: parseFloat(prod.querySelector("vICMS")?.textContent || '0'),
                                cfop: prod.querySelector("CFOP")?.textContent?.trim() || ''
                            };
                            if (obj.cfop) tempCfops.add(obj.cfop);
                            tempProducts.push(obj);
                        });
                        resolve();
                    } catch (error) {
                        toast({ variant: "destructive", title: `Erro ao processar ${file.name}` });
                        reject(error);
                    }
                };
                reader.onerror = () => reject(new Error(`Erro ao ler o arquivo ${file.name}`));
                reader.readAsText(file);
            })
        );

        await Promise.all(fileReadPromises)
            .then(() => {
                setAllProducts(prev => [...prev, ...tempProducts]);
                setDisplayedProducts(prev => [...prev, ...tempProducts]);
                setCfops(prev => new Set([...prev, ...tempCfops]));
                toast({ title: "Sucesso!", description: `${files.length} arquivo(s) processado(s).` });
            })
            .catch(error => console.error(error))
            .finally(() => setIsLoading(false));

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveDuplicates = () => {
        const uniqueProductsMap = new Map<string, Product>();
        allProducts.forEach(prod => {
            const key = `${prod.nome}|${prod.ncm}|${prod.unidade}`;
            if (uniqueProductsMap.has(key)) {
                let existingProd = uniqueProductsMap.get(key)!;
                existingProd.qtd += prod.qtd;
                existingProd.valorTotal += prod.valorTotal;
                existingProd.valorUnit = existingProd.qtd > 0 ? existingProd.valorTotal / existingProd.qtd : 0;
            } else {
                uniqueProductsMap.set(key, { ...prod });
            }
        });
        const deduplicated = Array.from(uniqueProductsMap.values());
        setAllProducts(deduplicated);
        setDisplayedProducts(deduplicated);
        toast({ title: "Duplicados Removidos", description: "As quantidades e valores foram somados." });
    };
    
    const handleFilterByCfop = () => {
        if (!cfopFilter) {
            setDisplayedProducts(allProducts);
            return;
        }
        const filtered = allProducts.filter(p => p.cfop.includes(cfopFilter));
        setDisplayedProducts(filtered);
    };

    const handleClearFilter = () => {
        setCfopFilter('');
        setDisplayedProducts(allProducts);
    }

    const handleApurarInventario = (value: number) => {
        const totalAtual = allProducts.reduce((sum, p) => sum + p.valorTotal, 0);
        if (totalAtual === 0) {
            toast({ variant: "destructive", title: "Erro", description: "Valor total zerado, não é possível apurar." });
            return;
        }
        const fator = value / totalAtual;
        const apurado = allProducts.map(p => ({
            ...p,
            valorUnit: p.valorUnit * fator,
            valorTotal: p.valorTotal * fator,
        }));
        setAllProducts(apurado);
        setDisplayedProducts(apurado);
        toast({ title: "Inventário Apurado!", description: `Valor ajustado para ${formatCurrency(value)}.` });
    };

    const handleExportExcel = () => {
        const data = displayedProducts.map(p => ({
            Nome: p.nome, NCM: p.ncm, Unidade: p.unidade, Quantidade: p.qtd,
            'Valor Unitário': p.valorUnit, 'Valor Total': p.valorTotal, CFOP: p.cfop
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario");
        XLSX.writeFile(wb, "inventario.xlsx");
    };

    const handleExportPdf = () => {
        const doc = new jsPDF();
        autoTable(doc, {
            head: [['Nome', 'NCM', 'Qtd', 'Val. Unit.', 'Val. Total', 'CFOP']],
            body: displayedProducts.map(p => [
                p.nome, p.ncm, p.qtd.toFixed(2), formatCurrency(p.valorUnit), formatCurrency(p.valorTotal), p.cfop
            ]),
            styles: { fontSize: 8 }
        });
        doc.save('inventario.pdf');
    };

    const { totalGeral, quantidadeProdutos } = useMemo(() => {
        const distinctProducts = new Set(displayedProducts.map(p => `${p.nome}|${p.ncm}`));
        return {
            totalGeral: displayedProducts.reduce((sum, p) => sum + p.valorTotal, 0),
            quantidadeProdutos: distinctProducts.size,
        };
    }, [displayedProducts]);


    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/fiscal">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Voltar</span>
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Processador de Inventário por XML</h1>
            </div>

            <Card>
                <CardHeader><CardTitle>1. Importar Arquivos</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input type="file" ref={fileInputRef} multiple accept=".xml" className="flex-grow" onChange={handleFileChange} />
                        <Button onClick={handleRemoveDuplicates} variant="outline"><RotateCcw className="mr-2 h-4 w-4" /> Remover Duplicados</Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                 <Card>
                    <CardHeader><CardTitle>2. Filtrar Dados</CardTitle></CardHeader>
                    <CardContent className="flex gap-2">
                         <Input placeholder="Filtrar por CFOP..." value={cfopFilter} onChange={(e) => setCfopFilter(e.target.value)} />
                         <Button onClick={handleFilterByCfop}><Filter className="mr-2 h-4 w-4" /> Filtrar</Button>
                         <Button variant="ghost" onClick={handleClearFilter}>Limpar</Button>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>3. Apurar Inventário</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={(e) => { e.preventDefault(); handleApurarInventario(parseFloat(e.currentTarget.inventario.value)); }} className="flex gap-2">
                            <Input name="inventario" type="number" step="0.01" placeholder="Valor do inventário a ser alcançado" />
                            <Button type="submit"><Calculator className="mr-2 h-4 w-4" /> Apurar</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>4. Dados dos Produtos</CardTitle>
                    <CardDescription>Lista de produtos importados e processados.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg w-full">
                        <div className="relative w-full overflow-auto max-h-96">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background">
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>NCM</TableHead>
                                        <TableHead>CFOP</TableHead>
                                        <TableHead className="text-right">Qtd.</TableHead>
                                        <TableHead className="text-right">Val. Unit.</TableHead>
                                        <TableHead className="text-right">Val. Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>
                                    ) : displayedProducts.length > 0 ? (
                                        displayedProducts.map((p, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium max-w-xs truncate">{p.nome}</TableCell>
                                                <TableCell>{p.ncm}</TableCell>
                                                <TableCell>{p.cfop}</TableCell>
                                                <TableCell className="text-right">{p.qtd.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(p.valorUnit)}</TableCell>
                                                <TableCell className="text-right font-semibold">{formatCurrency(p.valorTotal)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhum produto a exibir.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                     <div className="flex justify-between items-center mt-4 pt-4 border-t">
                        <div>
                            <p className="text-sm">CFOPs encontrados:</p>
                             <div className="flex flex-wrap gap-1 mt-1">
                                {Array.from(cfops).map(c => <Badge key={c} variant="secondary">{c}</Badge>)}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm">Produtos Distintos: <span className="font-bold">{quantidadeProdutos}</span></p>
                            <p className="text-lg font-bold">Total Geral: {formatCurrency(totalGeral)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>5. Exportar</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-2">
                    <Button onClick={handleExportExcel}><FileDown className="mr-2 h-4 w-4" /> Exportar para Excel</Button>
                    <Button onClick={handleExportPdf} variant="outline"><FileDown className="mr-2 h-4 w-4" /> Exportar para PDF</Button>
                </CardContent>
            </Card>

        </div>
    );
}
