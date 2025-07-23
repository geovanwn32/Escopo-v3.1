
"use client";

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UploadCloud, File as FileIcon, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function ImportacaoExtratoPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
            if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.txt')) {
                toast({ variant: 'destructive', title: 'Tipo de arquivo inválido', description: 'Por favor, selecione um arquivo PDF, Excel (.xlsx) ou TXT.' });
                return;
            }
            setFile(selectedFile);
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
        // Placeholder for actual processing logic
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast({ title: 'Processamento Concluído!', description: `${file.name} foi processado. (Simulação)` });
        setIsProcessing(false);
        setFile(null); // Clear file after processing
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
                    <CardDescription>Arraste e solte ou selecione o arquivo do seu extrato bancário (PDF, TXT, XLSX).</CardDescription>
                </CardHeader>
                <CardContent>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.txt,.xlsx"
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
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFile(null)}>
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
        </div>
    );
}
