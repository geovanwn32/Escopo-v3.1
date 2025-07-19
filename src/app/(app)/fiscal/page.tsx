
"use client";

import { useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileStack, ArrowUpRightSquare, ArrowDownLeftSquare, FileText, Upload, FileUp, Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface XmlFile {
  file: File;
  status: 'pending' | 'launched';
}

export default function FiscalPage() {
  const [xmlFiles, setXmlFiles] = useState<XmlFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files)
        .filter(file => file.type === 'text/xml' || file.name.endsWith('.xml'))
        .map(file => ({ file, status: 'pending' } as XmlFile));
      setXmlFiles(prevFiles => [...prevFiles, ...newFiles]);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleLaunch = (fileName: string) => {
    // Placeholder for launch logic
    console.log(`Launching form for ${fileName}`);
    setXmlFiles(files => files.map(f => f.file.name === fileName ? { ...f, status: 'launched' } : f));
  };

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".xml,text/xml"
        multiple
      />
      <h1 className="text-2xl font-bold">Módulo Fiscal</h1>
      <Card>
        <CardHeader>
          <CardTitle>Ações Fiscais</CardTitle>
          <CardDescription>Realize lançamentos fiscais de forma rápida.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button><ArrowUpRightSquare className="mr-2 h-4 w-4" /> Lançar Nota de Saída</Button>
          <Button variant="secondary"><ArrowDownLeftSquare className="mr-2 h-4 w-4" /> Lançar Nota de Entrada</Button>
          <Button variant="outline"><FileText className="mr-2 h-4 w-4" /> Lançar Nota de Serviço</Button>
          <Button variant="outline" onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" /> Importar XML
          </Button>
        </CardContent>
      </Card>

      {xmlFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Arquivos XML Importados</CardTitle>
            <CardDescription>Gerencie e realize o lançamento dos arquivos XML importados.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Arquivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {xmlFiles.map(({ file, status }) => (
                  <TableRow key={file.name}>
                    <TableCell className="font-medium">{file.name}</TableCell>
                    <TableCell>
                      {status === 'pending' ? (
                        <Badge variant="secondary">Pendente</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-600">Lançado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleLaunch(file.name)} disabled={status === 'launched'}>
                        {status === 'pending' ? <FileUp className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                        {status === 'pending' ? 'Lançar' : 'Lançado'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos Recentes</CardTitle>
          <CardDescription>Visualize os últimos lançamentos fiscais.</CardDescription>
        </CardHeader>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 bg-muted rounded-full mb-4">
            <FileStack className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold">Nenhum lançamento fiscal encontrado</h3>
          <p className="text-muted-foreground mt-2">Use os botões acima para começar a lançar notas.</p>
        </div>
      </Card>
    </div>
  );
}
