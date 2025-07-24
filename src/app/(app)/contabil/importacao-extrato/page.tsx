
"use client";

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UploadCloud, File as FileIcon, X, Loader2, ListChecks, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { extractBankTransactions, type BankTransaction } from '@/ai/flows/extract-transactions-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';


const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
};

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};


export default function ImportacaoExtratoPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedTransactions, setExtractedTransactions] = useState<BankTransaction[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
            
            if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.txt') && !selectedFile.name.endsWith('.csv')) {
                toast({ variant: 'destructive', title: 'Tipo de arquivo inválido', description: 'Por favor, selecione um arquivo PDF, Excel (.xlsx), CSV ou TXT.' });
                return;
            }
            setFile(selectedFile);
            setExtractedTransactions([]); // Clear previous results when new file is selected
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileInputRef.current!.files = e.dataTransfer.files;
            handleFileChange({ target: fileInputRef.current } as any);
        }
    };
    
    const handleProcessFile = async () => {
        if (!file) {
            toast({ variant: 'destructive', title: 'Nenhum arquivo selecionado.' });
            return;
        }

        setIsProcessing(true);
        setExtractedTransactions([]);
        
        try {
            const fileDataUri = await fileToBase64(file);

            const result = await extractBankTransactions({ 
                fileDataUri, 
                mimeType: file.type 
            });

            if (result.transactions && result.transactions.length > 0) {
                setExtractedTransactions(result.transactions);
                 toast({ title: 'Transações Extraídas!', description: 'Revise os lançamentos abaixo antes de contabilizar.' });
            } else {
                 toast({ title: 'Nenhuma transação encontrada', description: 'A IA não conseguiu extrair transações do arquivo. Verifique o conteúdo e tente novamente.' });
            }
        } catch (error) {
            console.error("Error processing file:", error);
            toast({ variant: 'destructive', title: 'Erro no Processamento', description: 'Não foi possível analisar o arquivo.' });
        } finally {
            setIsProcessing(false);
        }
    };

    const resetState = () => {
        setFile(null);
        setExtractedTransactions([]);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/contabil">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Voltar</span>
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Importação de Extrato Bancário</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Enviar Extrato</CardTitle>
                    <CardDescription>Arraste e solte ou selecione o arquivo do seu extrato bancário (PDF, TXT, CSV, XLSX).</CardDescription>
                </CardHeader>
                <CardContent>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.txt,.csv,.xlsx"
                    />
                    <div
                        className={cn(
                            "border-2 border-dashed border-muted-foreground/30 rounded-lg p-12 text-center transition-colors cursor-pointer",
                            isDragging && "border-primary bg-primary/10"
                        )}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                            <UploadCloud className="h-12 w-12" />
                            <div>
                                <p className="font-semibold text-foreground">Arraste seu arquivo aqui</p>
                                <p className="text-sm">ou clique para selecionar</p>
                            </div>
                        </div>
                    </div>
                    {file && (
                         <div className="mt-6">
                             <h4 className="text-lg font-medium">Arquivo Selecionado</h4>
                            <div className="flex items-center justify-between p-3 mt-2 border rounded-md bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <FileIcon className="h-6 w-6 text-muted-foreground"/>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{file.name}</span>
                                        <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetState}>
                                    <X className="h-4 w-4"/>
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleProcessFile} disabled={!file || isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        {isProcessing ? 'Processando...' : 'Processar Arquivo'}
                    </Button>
                </CardFooter>
            </Card>

            {extractedTransactions.length > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Transações Extraídas</CardTitle>
                        <CardDescription>Revise as transações identificadas pela IA antes de prosseguir.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="border rounded-md max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {extractedTransactions.map((tx, index) => (
                                    <TableRow key={index}>
                                    <TableCell className="font-mono">{tx.date}</TableCell>
                                    <TableCell>{tx.description}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={tx.type === 'credit' ? 'default' : 'destructive'} className="font-mono">
                                            {formatCurrency(tx.amount)}
                                        </Badge>
                                    </TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                         </div>
                    </CardContent>
                    <CardFooter className="justify-end">
                        <Button disabled>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Contabilizar Lançamentos (Em Breve)
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}

