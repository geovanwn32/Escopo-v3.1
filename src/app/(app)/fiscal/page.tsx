
"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileStack, ArrowUpRightSquare, ArrowDownLeftSquare, FileText, Upload, FileUp, Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface XmlFile {
  file: File;
  status: 'pending' | 'launched' | 'error';
  type: 'entrada' | 'saida' | 'servico' | 'desconhecido';
  error?: string;
}

export default function FiscalPage() {
  const [xmlFiles, setXmlFiles] = useState<XmlFile[]>([]);
  const [activeCompanyCnpj, setActiveCompanyCnpj] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();


  useEffect(() => {
    if (typeof window !== 'undefined') {
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (user && companyId) {
            const companyData = sessionStorage.getItem(`company_${companyId}`);
             if (companyData) {
                 setActiveCompanyCnpj(JSON.parse(companyData).cnpj);
             }
        }
    }
  }, [user]);
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = await Promise.all(Array.from(event.target.files)
        .filter(file => file.type === 'text/xml' || file.name.endsWith('.xml'))
        .map(async (file) => {
            const fileContent = await file.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(fileContent, "text/xml");
            
            let type: XmlFile['type'] = 'desconhecido';
            let emitCnpj: string | null = null;
            let destCnpj: string | null = null;
            const normalizedActiveCnpj = activeCompanyCnpj?.replace(/\D/g, '');

            const nfeProc = xmlDoc.getElementsByTagName('nfeProc')[0];
            const nfseNode = xmlDoc.getElementsByTagName('NFSe')[0] || xmlDoc.getElementsByTagName('CompNfse')[0];

            if (nfeProc) { // It's a standard NFe (product)
                const emitNode = nfeProc.getElementsByTagName('emit')[0];
                const destNode = nfeProc.getElementsByTagName('dest')[0];
                emitCnpj = emitNode?.getElementsByTagName('CNPJ')[0]?.textContent ?? null;
                destCnpj = destNode?.getElementsByTagName('CNPJ')[0]?.textContent ?? null;
                
                if (emitCnpj === normalizedActiveCnpj) {
                    type = 'saida';
                } else if (destCnpj === normalizedActiveCnpj) {
                    type = 'entrada';
                }
            } else if (nfseNode) { // It's a NFS-e (service)
                const prestNode = nfseNode.getElementsByTagName('prest')[0] || nfseNode.getElementsByTagName('emit')[0];
                const tomaNode = nfseNode.getElementsByTagName('toma')[0] || nfseNode.getElementsByTagName('dest')[0];

                emitCnpj = prestNode?.getElementsByTagName('CNPJ')[0]?.textContent ?? null;
                destCnpj = tomaNode?.getElementsByTagName('CNPJ')[0]?.textContent ?? null;

                if (emitCnpj === normalizedActiveCnpj || destCnpj === normalizedActiveCnpj) {
                    type = 'servico';
                }
            }
            
            if (type !== 'desconhecido') {
              return { file, status: 'pending', type } as XmlFile;
            } else {
              toast({
                variant: "destructive",
                title: `Arquivo Inválido: ${file.name}`,
                description: "O CNPJ do emitente ou destinatário não corresponde à empresa ativa, ou o tipo de nota é desconhecido.",
              })
              return null;
            }
        }));
      
      const validFiles = newFiles.filter(Boolean) as XmlFile[];
      setXmlFiles(prevFiles => [...prevFiles, ...validFiles]);
    }
  };

  const handleImportClick = () => {
    if (!activeCompanyCnpj) {
        toast({
            variant: "destructive",
            title: "Nenhuma empresa ativa",
            description: "Selecione uma empresa antes de importar arquivos.",
        });
        return;
    }
    fileInputRef.current?.click();
  };
  
  const handleLaunch = (file: XmlFile) => {
    console.log(`Launching form for ${file.file.name} of type ${file.type}`);
    setXmlFiles(files => files.map(f => f.file.name === file.file.name ? { ...f, status: 'launched' } : f));
    toast({
        title: "Lançamento realizado!",
        description: `O arquivo ${file.file.name} foi lançado com sucesso.`
    })
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {xmlFiles.map((xmlFile) => (
                  <TableRow key={xmlFile.file.name}>
                    <TableCell className="font-medium">{xmlFile.file.name}</TableCell>
                     <TableCell>
                      <Badge variant={xmlFile.type === 'desconhecido' ? 'destructive' : 'secondary'}>
                        {xmlFile.type.charAt(0).toUpperCase() + xmlFile.type.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {xmlFile.status === 'pending' ? (
                        <Badge variant="secondary">Pendente</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-600">Lançado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleLaunch(xmlFile)} disabled={xmlFile.status === 'launched' || xmlFile.type === 'desconhecido'}>
                        {xmlFile.status === 'pending' ? <FileUp className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                        {xmlFile.status === 'pending' ? 'Lançar' : 'Lançado'}
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
