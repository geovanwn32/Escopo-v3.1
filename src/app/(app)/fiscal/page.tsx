
"use client";

import { useState, useRef, useEffect } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileStack, ArrowUpRightSquare, ArrowDownLeftSquare, FileText, Upload, FileUp, Check, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { LaunchFormModal } from "@/components/fiscal/launch-form-modal";

interface XmlFile {
  file: {
    name: string;
    type: string;
    size: number;
    lastModified: number;
  };
  content: string;
  status: 'pending' | 'launched' | 'error';
  type: 'entrada' | 'saida' | 'servico' | 'desconhecido';
  error?: string;
}

interface Launch {
    id: string;
    fileName: string;
    type: string;
    value: number;
    date: Date;
    chaveNfe?: string;
    numeroNfse?: string;
}

// Helper to safely stringify with support for File objects
function replacer(key: string, value: any) {
  if (value instanceof File) {
    return {
      _type: 'File',
      name: value.name,
      size: value.size,
      type: value.type,
      lastModified: value.lastModified,
    };
  }
  return value;
}

// Helper to safely parse with support for File objects
function reviver(key: string, value: any) {
  if (value && value._type === 'File') {
    // We can't recreate the file content, but we can recreate the object structure
    // This is sufficient for display and state management purposes
    return new File([], value.name, { type: value.type, lastModified: value.lastModified });
  }
  return value;
}


export default function FiscalPage() {
  const [xmlFiles, setXmlFiles] = useState<XmlFile[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loadingLaunches, setLoadingLaunches] = useState(true);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyCnpj, setActiveCompanyCnpj] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedXml, setSelectedXml] = useState<XmlFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (user && companyId) {
            setActiveCompanyId(companyId);
            const companyData = sessionStorage.getItem(`company_${companyId}`);
            if (companyData) {
                setActiveCompanyCnpj(JSON.parse(companyData).cnpj);
            }
            const storedFiles = sessionStorage.getItem(`xmlFiles_${companyId}`);
            if (storedFiles) {
                setXmlFiles(JSON.parse(storedFiles, reviver));
            }
        }
    }
  }, [user]);

  useEffect(() => {
    if (activeCompanyId) {
        sessionStorage.setItem(`xmlFiles_${activeCompanyId}`, JSON.stringify(xmlFiles, replacer));
    }
  }, [xmlFiles, activeCompanyId]);


  useEffect(() => {
    if (!activeCompanyId) {
        setLoadingLaunches(false);
        setLaunches([]);
        return;
    };

    setLoadingLaunches(true);
    const launchesRef = collection(db, `users/${user!.uid}/companies/${activeCompanyId}/launches`);
    const q = query(launchesRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const launchesData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: (data.date as Timestamp).toDate(),
            } as Launch
        });
        setLaunches(launchesData);
        setLoadingLaunches(false);
    }, (error) => {
        console.error("Error fetching launches: ", error);
        toast({
            variant: "destructive",
            title: "Erro ao buscar lançamentos",
            description: "Não foi possível carregar os lançamentos recentes."
        });
        setLoadingLaunches(false);
    });

    return () => unsubscribe();
  }, [activeCompanyId, user, toast]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFilesPromises = Array.from(event.target.files)
        .filter(file => file.type === 'text/xml' || file.name.endsWith('.xml'))
        .map(async (file) => {
            const fileContent = await file.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(fileContent, "text/xml");
            
            let type: XmlFile['type'] = 'desconhecido';
            const normalizedActiveCnpj = activeCompanyCnpj?.replace(/\D/g, '');

            const findCnpj = (xml: Document, potentialTags: string[]) => {
              for (const tag of potentialTags) {
                const nodeList = xml.getElementsByTagName(tag);
                if (nodeList.length > 0) {
                  const cnpjNode = nodeList[0].getElementsByTagName('CNPJ')[0];
                  if (cnpjNode && cnpjNode.textContent) return cnpjNode.textContent.replace(/\D/g, '');
                }
              }
              return null;
            }

            // NF-e (Produto) - Higher priority
            if (xmlDoc.getElementsByTagName('nfeProc').length > 0) {
                const emitCnpj = findCnpj(xmlDoc, ['emit']);
                const destCnpj = findCnpj(xmlDoc, ['dest']);

                if (emitCnpj === normalizedActiveCnpj) {
                    type = 'saida'; // Selling a product
                } else if (destCnpj === normalizedActiveCnpj) {
                    type = 'entrada'; // Buying a product
                }
            } 
            // NFS-e (Serviço)
            else if (xmlDoc.getElementsByTagName('NFSe').length > 0 || xmlDoc.getElementsByTagName('CompNfse').length > 0) {
                const prestadorCnpj = findCnpj(xmlDoc, ['prest', 'PrestadorServico', 'emit']);
                const tomadorCnpj = findCnpj(xmlDoc, ['toma', 'TomadorServico', 'dest']);

                if (prestadorCnpj === normalizedActiveCnpj) {
                  type = 'servico'; // Providing a service (income)
                } else if (tomadorCnpj === normalizedActiveCnpj) {
                  type = 'saida'; // Taking a service (expense)
                }
            }
            
            if (type !== 'desconhecido') {
              const fileData = {
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  lastModified: file.lastModified,
              };
              return { file: fileData, content: fileContent, status: 'pending', type } as XmlFile;
            } else {
              toast({
                variant: "destructive",
                title: `Arquivo Inválido: ${file.name}`,
                description: "O CNPJ do emitente ou destinatário não corresponde à empresa ativa, ou o tipo de nota é desconhecido.",
              })
              return null;
            }
        });
      
      const newFiles = (await Promise.all(newFilesPromises)).filter(Boolean) as XmlFile[];
      setXmlFiles(prevFiles => {
        const existingFileNames = new Set(prevFiles.map(f => f.file.name));
        const uniqueNewFiles = newFiles.filter(f => !existingFileNames.has(f.file.name));
        return [...prevFiles, ...uniqueNewFiles];
      });
      // Clear file input to allow re-uploading the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
    const fileObject = new File([file.content], file.file.name, { type: file.file.type });
    setSelectedXml({ ...file, file: fileObject });
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedXml(null);
  }

  const handleLaunchSuccess = (fileName: string) => {
     setXmlFiles(files => files.map(f => f.file.name === fileName ? { ...f, status: 'launched' } : f));
     handleModalClose();
  }


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
        <CardContent>
            {loadingLaunches ? (
                 <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
            ) : launches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-4 bg-muted rounded-full mb-4">
                    <FileStack className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold">Nenhum lançamento fiscal encontrado</h3>
                  <p className="text-muted-foreground mt-2">Use os botões acima para começar a lançar notas.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Chave/Número</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {launches.map(launch => (
                            <TableRow key={launch.id}>
                                <TableCell>{new Intl.DateTimeFormat('pt-BR').format(launch.date)}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary">
                                      {launch.type.charAt(0).toUpperCase() + launch.type.slice(1)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{launch.chaveNfe || launch.numeroNfse}</TableCell>
                                <TableCell className="text-right font-medium">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(launch.value)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
      {selectedXml && user && activeCompanyId && (
        <LaunchFormModal 
            isOpen={isModalOpen}
            onClose={handleModalClose}
            xmlFile={{ ...selectedXml, file: new File([selectedXml.content], selectedXml.file.name, {type: selectedXml.file.type}) }}
            userId={user.uid}
            companyId={activeCompanyId}
            onLaunchSuccess={handleLaunchSuccess}
        />
      )}
    </div>
  );
}

    