

"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileStack, ArrowUpRightSquare, ArrowDownLeftSquare, FileText, Upload, FileUp, Check, Loader2, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, FilterX, Calendar as CalendarIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { LaunchFormModal } from "@/components/fiscal/launch-form-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export interface Company {
    id: string;
    nomeFantasia: string;
    razaoSocial: string;
    cnpj: string;
}

export interface Launch {
    id: string;
    fileName: string;
    type: string;
    date: Date;
    chaveNfe?: string;
    numeroNfse?: string;
    
    // NFS-e fields
    prestador?: { nome: string; cnpj: string; };
    tomador?: { nome: string; cnpj: string; };
    discriminacao?: string;
    itemLc116?: string;
    valorServicos?: number;
    valorPis?: number;
    valorCofins?: number;
    valorIr?: number;
    valorInss?: number;
    valorCsll?: number;
    valorLiquido?: number;

    // NF-e fields
    emitente?: { nome: string; cnpj: string; };
    destinatario?: { nome: string; cnpj: string; };
    valorProdutos?: number;
    valorTotalNota?: number;
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
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedXml, setSelectedXml] = useState<XmlFile | null>(null);
  const [editingLaunch, setEditingLaunch] = useState<Launch | null>(null);
  const [manualLaunchType, setManualLaunchType] = useState<'entrada' | 'saida' | 'servico' | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [xmlCurrentPage, setXmlCurrentPage] = useState(1);
  const xmlItemsPerPage = 5;

  const [filterKey, setFilterKey] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>();
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>();


  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const companyId = sessionStorage.getItem('activeCompanyId');
        if (user && companyId) {
            const companyDataString = sessionStorage.getItem(`company_${companyId}`);
            if (companyDataString) {
                const companyData = JSON.parse(companyDataString);
                setActiveCompany(companyData);
            }
            const storedFiles = sessionStorage.getItem(`xmlFiles_${companyId}`);
            if (storedFiles) {
                setXmlFiles(JSON.parse(storedFiles, reviver));
            }
        }
    }
  }, [user]);

  useEffect(() => {
    if (activeCompany) {
        sessionStorage.setItem(`xmlFiles_${activeCompany.id}`, JSON.stringify(xmlFiles, replacer));
    }
  }, [xmlFiles, activeCompany]);


  useEffect(() => {
    if (!activeCompany) {
        setLoadingLaunches(false);
        setLaunches([]);
        return;
    };

    setLoadingLaunches(true);
    const launchesRef = collection(db, `users/${user!.uid}/companies/${activeCompany.id}/launches`);
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
  }, [activeCompany, user, toast]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFilesPromises = Array.from(event.target.files)
        .filter(file => file.type === 'text/xml' || file.name.endsWith('.xml'))
        .map(async (file) => {
            const fileContent = await file.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(fileContent, "text/xml");
            const normalizedActiveCnpj = activeCompany?.cnpj?.replace(/\D/g, '');

            let type: XmlFile['type'] = 'desconhecido';

            const findCnpj = (potentialParents: (Element | null | undefined)[], cnpjTagName: string): string | null => {
              for (const parentNode of potentialParents) {
                  if (parentNode) {
                      const cnpjNodes = Array.from(parentNode.getElementsByTagName(cnpjTagName));
                       if (cnpjNodes.length > 0 && cnpjNodes[0].textContent) {
                           return cnpjNodes[0].textContent.replace(/\D/g, '');
                       }
                      // Fallback for namespaced tags
                      const namespacedNodes = Array.from(parentNode.getElementsByTagNameNS('*', cnpjTagName));
                       if (namespacedNodes.length > 0 && namespacedNodes[0].textContent) {
                           return namespacedNodes[0].textContent.replace(/\D/g, '');
                       }
                  }
              }
              return null;
            };

            const nfeProc = xmlDoc.getElementsByTagName('nfeProc')[0];
            const nfse = xmlDoc.getElementsByTagName('NFSe')[0] || xmlDoc.getElementsByTagName('CompNfse')[0];

            if (nfeProc) {
                const emitNode = nfeProc.getElementsByTagName('emit')[0];
                const destNode = nfeProc.getElementsByTagName('dest')[0];
                const emitCnpj = findCnpj([emitNode], 'CNPJ');
                const destCnpj = findCnpj([destNode], 'CNPJ');
                
                if (emitCnpj === normalizedActiveCnpj) {
                    type = 'saida'; // Venda de produto (saída de mercadoria, mas entrada de receita)
                } else if (destCnpj === normalizedActiveCnpj) {
                    type = 'entrada'; // Compra de produto
                }
            } else if (nfse) {
                const prestadorNode = nfse.querySelector('PrestadorServico, prest');
                const tomadorNode = nfse.querySelector('TomadorServico, toma');

                const prestadorCnpj = findCnpj([prestadorNode], 'Cnpj');
                const tomadorCnpj = findCnpj([tomadorNode], 'Cnpj');

                if (prestadorCnpj === normalizedActiveCnpj) {
                    type = 'servico'; // Prestação de serviço (é uma entrada de receita)
                } else if (tomadorCnpj === normalizedActiveCnpj) {
                    type = 'saida'; // Tomada de serviço (é uma despesa/saída)
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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImportClick = () => {
    if (!activeCompany) {
        toast({
            variant: "destructive",
            title: "Nenhuma empresa ativa",
            description: "Selecione uma empresa antes de importar arquivos.",
        });
        return;
    }
    fileInputRef.current?.click();
  };
  
  const handleLaunchFromXml = (file: XmlFile) => {
    setModalMode('create');
    const fileObject = new File([file.content], file.file.name, { type: file.file.type });
    setSelectedXml({ ...file, file: fileObject });
    setEditingLaunch(null);
    setManualLaunchType(null);
    setIsModalOpen(true);
  };
  
  const handleManualLaunch = (type: 'saida' | 'entrada' | 'servico') => {
    setModalMode('create');
    setSelectedXml(null);
    setEditingLaunch(null);
    setManualLaunchType(type);
    setIsModalOpen(true);
  };

  const handleViewLaunch = (launch: Launch) => {
    setModalMode('view');
    setEditingLaunch(launch);
    setSelectedXml(null);
    setManualLaunchType(null);
    setIsModalOpen(true);
  };

  const handleEditLaunch = (launch: Launch) => {
    setModalMode('edit');
    setEditingLaunch(launch);
    setSelectedXml(null);
    setManualLaunchType(null);
    setIsModalOpen(true);
  };

  const handleDeleteLaunch = async (launch: Launch) => {
    if (!user || !activeCompany) return;
    try {
        const launchRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/launches`, launch.id);
        await deleteDoc(launchRef);
        
        setXmlFiles(files => 
            files.map(f => 
                f.file.name === launch.fileName ? { ...f, status: 'pending' } : f
            )
        );

        toast({
            title: "Lançamento excluído com sucesso!"
        });
    } catch (error) {
        console.error("Error deleting launch: ", error);
        toast({
            variant: "destructive",
            title: "Erro ao excluir lançamento",
            description: "Não foi possível remover o lançamento."
        });
    }
  };

  const handleDeleteXmlFile = (fileName: string) => {
    setXmlFiles(files => files.filter(f => f.file.name !== fileName));
    toast({
        title: "Arquivo XML removido",
        description: `O arquivo ${fileName} foi removido da lista.`
    });
  };


  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedXml(null);
    setEditingLaunch(null);
    setManualLaunchType(null);
  }

  const handleLaunchSuccess = (fileName: string) => {
     if (fileName) {
        setXmlFiles(files => files.map(f => f.file.name === fileName ? { ...f, status: 'launched' } : f));
     }
     handleModalClose();
  }
  
  const filteredLaunches = useMemo(() => {
    return launches.filter(launch => {
        const keyMatch = filterKey ? (launch.chaveNfe?.includes(filterKey) || launch.numeroNfse?.includes(filterKey)) : true;
        const typeMatch = filterType ? launch.type === filterType : true;
        
        let dateMatch = true;
        if (filterStartDate) {
            const launchDate = new Date(launch.date);
            launchDate.setHours(0,0,0,0);
            const startDate = new Date(filterStartDate);
            startDate.setHours(0,0,0,0);
            dateMatch = launchDate >= startDate;
        }
        if (filterEndDate && dateMatch) {
            const launchDate = new Date(launch.date);
            launchDate.setHours(23,59,59,999);
            const endDate = new Date(filterEndDate);
endDate.setHours(23,59,59,999);
            dateMatch = launchDate <= endDate;
        }

        return keyMatch && typeMatch && dateMatch;
    });
  }, [launches, filterKey, filterType, filterStartDate, filterEndDate]);

  const clearFilters = () => {
    setFilterKey("");
    setFilterType("");
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
  };
  
  const getPartnerName = (launch: Launch): string => {
    switch (launch.type) {
      case 'entrada':
        return launch.emitente?.nome || 'N/A';
      case 'saida':
        return launch.destinatario?.nome || 'N/A';
      case 'servico':
        return launch.tomador?.nome || 'N/A';
      default:
        return 'N/A';
    }
  };


  // XML files pagination logic
  const totalXmlPages = Math.ceil(xmlFiles.length / xmlItemsPerPage);
  const paginatedXmlFiles = xmlFiles.slice(
    (xmlCurrentPage - 1) * xmlItemsPerPage,
    xmlCurrentPage * xmlItemsPerPage
  );


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
          <Button onClick={() => handleManualLaunch('saida')}><ArrowUpRightSquare className="mr-2 h-4 w-4" /> Lançar Nota de Saída</Button>
          <Button onClick={() => handleManualLaunch('entrada')} variant="secondary"><ArrowDownLeftSquare className="mr-2 h-4 w-4" /> Lançar Nota de Entrada</Button>
          <Button onClick={() => handleManualLaunch('servico')} variant="outline"><FileText className="mr-2 h-4 w-4" /> Lançar Nota de Serviço</Button>
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
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedXmlFiles.map((xmlFile) => (
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
                    <TableCell className="text-right space-x-2">
                        <Button size="sm" onClick={() => handleLaunchFromXml(xmlFile)} disabled={xmlFile.status === 'launched' || xmlFile.type === 'desconhecido'}>
                            {xmlFile.status === 'pending' ? <FileUp className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                            {xmlFile.status === 'pending' ? 'Lançar' : 'Lançado'}
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" title="Excluir arquivo da lista">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta ação não pode ser desfeita. O arquivo XML será removido da lista de importação, mas o lançamento fiscal associado (se houver) não será excluído.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteXmlFile(xmlFile.file.name)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
           {totalXmlPages > 1 && (
            <CardFooter className="flex justify-end items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setXmlCurrentPage(p => p - 1)} disabled={xmlCurrentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                </Button>
                <span className="text-sm text-muted-foreground">Página {xmlCurrentPage} de {totalXmlPages}</span>
                <Button variant="outline" size="sm" onClick={() => setXmlCurrentPage(p => p + 1)} disabled={xmlCurrentPage === totalXmlPages}>
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </CardFooter>
           )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos Recentes</CardTitle>
          <CardDescription>Visualize e filtre os lançamentos fiscais.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50">
                <Input
                    placeholder="Filtrar por Chave/Número..."
                    value={filterKey}
                    onChange={(e) => setFilterKey(e.target.value)}
                    className="max-w-xs"
                />
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar por Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="saida">Saída</SelectItem>
                        <SelectItem value="servico">Serviço</SelectItem>
                    </SelectContent>
                </Select>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className="w-full sm:w-[280px] justify-start text-left font-normal"
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filterStartDate && filterEndDate ? (
                                <>
                                {format(filterStartDate, "dd/MM/yy")} - {format(filterEndDate, "dd/MM/yy")}
                                </>
                            ) : <span>Filtrar por Data</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                        mode="range"
                        selected={{ from: filterStartDate, to: filterEndDate }}
                        onSelect={(range) => {
                            setFilterStartDate(range?.from);
                            setFilterEndDate(range?.to);
                        }}
                        locale={ptBR}
                        numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
                <Button variant="ghost" onClick={clearFilters} className="sm:ml-auto">
                    <FilterX className="mr-2 h-4 w-4" />
                    Limpar Filtros
                </Button>
            </div>
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
                            <TableHead>Parceiro</TableHead>
                            <TableHead>Chave/Número</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLaunches.length === 0 ? (
                             <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Nenhum resultado encontrado para os filtros aplicados.
                                </TableCell>
                            </TableRow>
                        ) : filteredLaunches.map(launch => (
                            <TableRow key={launch.id}>
                                <TableCell>{new Intl.DateTimeFormat('pt-BR').format(launch.date)}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary">
                                      {launch.type.charAt(0).toUpperCase() + launch.type.slice(1)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                    {getPartnerName(launch)}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{launch.chaveNfe || launch.numeroNfse}</TableCell>
                                <TableCell className="text-right font-medium">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(launch.valorLiquido || launch.valorTotalNota || 0)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleViewLaunch(launch)}>
                                            <Eye className="mr-2 h-4 w-4" />
                                            Visualizar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleEditLaunch(launch)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Alterar
                                        </DropdownMenuItem>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                     <Trash2 className="mr-2 h-4 w-4" />
                                                     Excluir
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta ação não pode ser desfeita. O lançamento fiscal será permanentemente removido.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteLaunch(launch)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
      {isModalOpen && user && activeCompany && (
        <LaunchFormModal 
            isOpen={isModalOpen}
            onClose={handleModalClose}
            xmlFile={selectedXml}
            launch={editingLaunch}
            manualLaunchType={manualLaunchType}
            mode={modalMode}
            userId={user.uid}
            company={activeCompany}
            onLaunchSuccess={handleLaunchSuccess}
        />
      )}
    </div>
  );

    

    

    
