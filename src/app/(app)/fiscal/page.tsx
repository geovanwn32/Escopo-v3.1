
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, deleteDoc, doc, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileStack, ArrowUpRightSquare, ArrowDownLeftSquare, FileText, Upload, FileUp, Check, Loader2, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, FilterX, Calendar as CalendarIcon, Search, FileX as FileXIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface XmlFile {
  file: {
    name: string;
    type: string;
    size: number;
    lastModified: number;
  };
  content: string;
  status: 'pending' | 'launched' | 'error' | 'cancelled';
  type: 'entrada' | 'saida' | 'servico' | 'desconhecido' | 'cancelamento';
  error?: string;
  key?: string; // NFe key or NFS-e unique identifier
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
  
  const [xmlNameFilter, setXmlNameFilter] = useState("");
  const [xmlTypeFilter, setXmlTypeFilter] = useState("");
  const [xmlStatusFilter, setXmlStatusFilter] = useState("");
  const [xmlCurrentPage, setXmlCurrentPage] = useState(1);
  const xmlItemsPerPage = 5;

  const [filterKey, setFilterKey] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>();
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>();
  const [launchesCurrentPage, setLaunchesCurrentPage] = useState(1);
  const launchesItemsPerPage = 5;


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
    if (!activeCompany || !user) {
        setLoadingLaunches(false);
        setLaunches([]);
        return;
    };

    setLoadingLaunches(true);
    const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/launches`);
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
    if (!event.target.files || !user || !activeCompany) return;

    const files = Array.from(event.target.files).filter(
        (file) => file.type === 'text/xml' || file.name.endsWith('.xml')
    );
    if (files.length === 0) return;

    // Get all existing launched keys (NFe chave or NFS-e identifier)
    const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/launches`);
    const existingLaunchesSnap = await getDocs(launchesRef);
    const launchedKeys = new Set(existingLaunchesSnap.docs.map(doc => doc.data().chaveNfe || doc.data().numeroNfse));
    
    const newFilesPromises = files.map(async (file): Promise<XmlFile | null> => {
        const fileContent = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fileContent, 'text/xml');
        const normalizedActiveCnpj = activeCompany?.cnpj?.replace(/\D/g, '');

        let type: XmlFile['type'] = 'desconhecido';
        let status: XmlFile['status'] = 'pending';
        let key: string | undefined = undefined;

        const getCnpjCpfFromNode = (node: Element | null): string | null => {
            if (!node) return null;
            const cnpj = node.querySelector('CNPJ, cnpj')?.textContent;
            if (cnpj) return cnpj.replace(/\D/g, '');
            const cpf = node.querySelector('CPF, cpf')?.textContent;
            if (cpf) return cpf.replace(/\D/g, '');
            return null;
        };

        const isNFe = xmlDoc.querySelector('infNFe');
        const isNFSe = xmlDoc.querySelector('CompNfse, NFSe');
        const isCancelled = xmlDoc.querySelector('procCancNFe, cancNFe');

        if (isCancelled) {
            type = 'cancelamento';
            status = 'cancelled';
        } else if (isNFe) {
            const emitCnpj = getCnpjCpfFromNode(isNFe.querySelector('emit'));
            const destCnpj = getCnpjCpfFromNode(isNFe.querySelector('dest'));
            
            key = (isNFe.getAttribute('Id') || '').replace(/\D/g, '');
            if (launchedKeys.has(key)) status = 'launched';

            if (emitCnpj === normalizedActiveCnpj) type = 'saida';
            else if (destCnpj === normalizedActiveCnpj) type = 'entrada';

        } else if (isNFSe) {
            const prestadorNode = isNFSe.querySelector('PrestadorServico, prest');
            const tomadorNode = isNFSe.querySelector('TomadorServico, toma');
            
            const prestadorCnpj = getCnpjCpfFromNode(prestadorNode);
            const tomadorCnpj = getCnpjCpfFromNode(tomadorNode);
            const numeroNfse = isNFSe.querySelector('Numero, nNFSe')?.textContent;
            
            key = `${prestadorCnpj}-${numeroNfse}`;
            if (launchedKeys.has(numeroNfse)) status = 'launched';

            if (prestadorCnpj === normalizedActiveCnpj) type = 'servico';
            else if (tomadorCnpj === normalizedActiveCnpj) type = 'saida';
        }

        if (type === 'desconhecido') {
             toast({
                variant: "destructive",
                title: `Arquivo Inválido: ${file.name}`,
                description: "O CNPJ do emitente ou destinatário não corresponde à empresa ativa, ou o tipo de nota é desconhecido.",
              })
            return null;
        }

        const fileData = { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified };
        return { file: fileData, content: fileContent, status, type, key };
    });

    const newFiles = (await Promise.all(newFilesPromises)).filter(Boolean) as XmlFile[];
    
    setXmlFiles(prevFiles => {
        const existingFileNames = new Set(prevFiles.map(f => f.file.name));
        const uniqueNewFiles = newFiles.filter(f => !existingFileNames.has(f.file.name));
        return [...prevFiles, ...uniqueNewFiles];
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
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
        
        // Find the corresponding XML file and set its status back to 'pending'
        const keyToMatch = launch.chaveNfe || launch.numeroNfse;
        setXmlFiles(files => 
            files.map(f => 
                f.key === keyToMatch ? { ...f, status: 'pending' } : f
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

  const handleLaunchSuccess = (launchedKey: string) => {
     if (launchedKey) {
        setXmlFiles(files => files.map(f => f.key === launchedKey ? { ...f, status: 'launched' } : f));
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

  useEffect(() => {
    setLaunchesCurrentPage(1);
  }, [filterKey, filterType, filterStartDate, filterEndDate]);

  const clearLaunchesFilters = () => {
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
         if (launch.destinatario?.nome) return launch.destinatario.nome;
         if (launch.tomador?.nome) return launch.tomador.nome;
         return 'N/A';
      case 'servico':
        return launch.tomador?.nome || 'N/A';
      default:
        return 'N/A';
    }
  };


  // XML files filtering and pagination logic
  const filteredXmlFiles = useMemo(() => {
    return xmlFiles.filter(file => {
        const nameMatch = file.file.name.toLowerCase().includes(xmlNameFilter.toLowerCase());
        const typeMatch = xmlTypeFilter ? file.type === xmlTypeFilter : true;
        const statusMatch = xmlStatusFilter ? file.status === xmlStatusFilter : true;
        return nameMatch && typeMatch && statusMatch;
    });
  }, [xmlFiles, xmlNameFilter, xmlTypeFilter, xmlStatusFilter]);

  useEffect(() => {
    setXmlCurrentPage(1);
  }, [xmlNameFilter, xmlTypeFilter, xmlStatusFilter]);

  const clearXmlFilters = () => {
    setXmlNameFilter("");
    setXmlTypeFilter("");
    setXmlStatusFilter("");
  };

  const totalXmlPages = Math.ceil(filteredXmlFiles.length / xmlItemsPerPage);
  const paginatedXmlFiles = filteredXmlFiles.slice(
    (xmlCurrentPage - 1) * xmlItemsPerPage,
    xmlCurrentPage * xmlItemsPerPage
  );

  // Launches pagination logic
  const totalLaunchPages = Math.ceil(filteredLaunches.length / launchesItemsPerPage);
  const paginatedLaunches = filteredLaunches.slice(
    (launchesCurrentPage - 1) * launchesItemsPerPage,
    launchesCurrentPage * launchesItemsPerPage
  );
  
  const getBadgeForXml = (xmlFile: XmlFile) => {
    const variantMap: {[key in XmlFile['status']]: "default" | "secondary" | "destructive"} = {
        pending: 'secondary',
        launched: 'default',
        cancelled: 'destructive',
        error: 'destructive',
    };
    const labelMap: {[key in XmlFile['status']]: string} = {
        pending: 'Pendente',
        launched: 'Lançado',
        cancelled: 'Cancelado',
        error: 'Erro'
    };
    
    return <Badge variant={variantMap[xmlFile.status]} className={cn({'bg-green-600 hover:bg-green-700': xmlFile.status === 'launched' })}>{labelMap[xmlFile.status]}</Badge>
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
          <Button onClick={() => handleManualLaunch('saida')}><ArrowUpRightSquare className="mr-2 h-4 w-4" /> Lançar Nota de Saída</Button>
          <Button onClick={() => handleManualLaunch('entrada')} className="bg-green-100 text-green-800 hover:bg-green-200"><ArrowDownLeftSquare className="mr-2 h-4 w-4" /> Lançar Nota de Entrada</Button>
          <Button onClick={() => handleManualLaunch('servico')} className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200"><FileText className="mr-2 h-4 w-4" /> Lançar Nota de Serviço</Button>
          <Button className="bg-orange-100 text-orange-800 hover:bg-orange-200" onClick={handleImportClick}>
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
            <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="Filtrar por nome..."
                      value={xmlNameFilter}
                      onChange={(e) => setXmlNameFilter(e.target.value)}
                      className="pl-8"
                  />
                </div>
                <Select value={xmlTypeFilter} onValueChange={setXmlTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar por Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="saida">Saída</SelectItem>
                        <SelectItem value="servico">Serviço</SelectItem>
                        <SelectItem value="cancelamento">Cancelamento</SelectItem>
                    </SelectContent>
                </Select>
                 <Select value={xmlStatusFilter} onValueChange={setXmlStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar por Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="launched">Lançado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="ghost" onClick={clearXmlFilters} className="sm:ml-auto">
                    <FilterX className="mr-2 h-4 w-4" />
                    Limpar Filtros
                </Button>
            </div>
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
                {paginatedXmlFiles.length > 0 ? paginatedXmlFiles.map((xmlFile) => (
                  <TableRow key={xmlFile.file.name}>
                    <TableCell className="font-medium max-w-xs truncate">{xmlFile.file.name}</TableCell>
                     <TableCell>
                      <Badge variant={xmlFile.type === 'desconhecido' || xmlFile.type === 'cancelamento' ? 'destructive' : 'secondary'}>
                        {xmlFile.type.charAt(0).toUpperCase() + xmlFile.type.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                        {getBadgeForXml(xmlFile)}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                        <Button size="sm" onClick={() => handleLaunchFromXml(xmlFile)} disabled={xmlFile.status !== 'pending'}>
                            {xmlFile.status === 'pending' ? <FileUp className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                            {labelMap[xmlFile.status]}
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
                )) : (
                   <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                          Nenhum arquivo encontrado para os filtros aplicados.
                      </TableCell>
                  </TableRow>
                )}
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
                <Button variant="ghost" onClick={clearLaunchesFilters} className="sm:ml-auto">
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
                        {paginatedLaunches.length === 0 ? (
                             <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Nenhum resultado encontrado para os filtros aplicados.
                                </TableCell>
                            </TableRow>
                        ) : paginatedLaunches.map(launch => (
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
        {totalLaunchPages > 1 && (
            <CardFooter className="flex justify-end items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setLaunchesCurrentPage(p => p - 1)} disabled={launchesCurrentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                </Button>
                <span className="text-sm text-muted-foreground">Página {launchesCurrentPage} de {totalLaunchPages}</span>
                <Button variant="outline" size="sm" onClick={() => setLaunchesCurrentPage(p => p + 1)} disabled={launchesCurrentPage === totalLaunchPages}>
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </CardFooter>
        )}
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
}

const labelMap: {[key in XmlFile['status']]: string} = {
    pending: 'Lançar',
    launched: 'Lançado',
    cancelled: 'Cancelado',
    error: 'Erro'
};
```</change>
  <change>
    <file>src/components/fiscal/launch-form-modal.tsx</file>
    <content><![CDATA[
"use client";

import { useState, useEffect, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Launch, Company } from '@/app/(app)/fiscal/page';
import { parse, format, isValid } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Textarea } from '../ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { Produto } from '@/types/produto';
import { upsertProductsFromLaunch } from '@/services/product-service';


interface XmlFile {
  file: File;
  content: string;
  status: 'pending' | 'launched' | 'error';
  type: 'entrada' | 'saida' | 'servico' | 'desconhecido';
}

interface LaunchFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  xmlFile: XmlFile | null;
  launch: Launch | null;
  manualLaunchType: 'entrada' | 'saida' | 'servico' | null;
  mode: 'create' | 'edit' | 'view';
  userId: string;
  company: Company;
  onLaunchSuccess: (launchedKey: string) => void;
}

const partySchema = z.object({
  nome: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
}).optional().nullable();

const productSchema = z.object({
    codigo: z.string(),
    descricao: z.string(),
    ncm: z.string(),
    cfop: z.string(),
    valorUnitario: z.number(),
}).partial();

const launchSchema = z.object({
  fileName: z.string(),
  type: z.string(),
  date: z.date(),
  chaveNfe: z.string().optional().nullable(),
  numeroNfse: z.string().optional().nullable(),
  prestador: partySchema,
  tomador: partySchema,
  discriminacao: z.string().optional().nullable(),
  itemLc116: z.string().optional().nullable(),
  valorServicos: z.number().optional().nullable(),
  valorPis: z.number().optional().nullable(),
  valorCofins: z.number().optional().nullable(),
  valorIr: z.number().optional().nullable(),
  valorInss: z.number().optional().nullable(),
  valorCsll: z.number().optional().nullable(),
  valorLiquido: z.number().optional().nullable(),
  emitente: partySchema,
  destinatario: partySchema,
  valorProdutos: z.number().optional().nullable(),
  valorTotalNota: z.number().optional().nullable(),
  produtos: z.array(productSchema).optional(),
});

type FormData = z.infer<typeof launchSchema>;

// Helper to query multiple tags, returning the first one found.
const querySelectorText = (element: Element | Document | null, selectors: string[]): string => {
  if (!element) return '';
  for (const selector of selectors) {
    const el = element.querySelector(selector);
    if (el?.textContent) {
      return el.textContent.trim();
    }
  }
  return '';
};


function parseXmlAdvanced(xmlString: string, type: 'entrada' | 'saida' | 'servico' | 'desconhecido'): Partial<FormData> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
        console.error("Error parsing XML:", errorNode.textContent);
        return {};
    }

    const data: Partial<FormData> = {};
    
    // Function to get party data (name, cnpj) from a specific node
    const getNodeData = (node: Element | null) => {
        if (!node) return { nome: null, cnpj: null };
        return {
            nome: querySelectorText(node, ['RazaoSocial', 'xNome', 'Nome']),
            cnpj: querySelectorText(node, ['Cnpj', 'CNPJ'])
        };
    };

    // --- General Data ---
    const dateStr = querySelectorText(xmlDoc, ['DataEmissao', 'dCompet', 'dtEmissao', 'dhEmi']);
    data.date = dateStr ? new Date(dateStr) : new Date();

    if (type === 'servico') {
        // --- NFS-e Parsing ---
        const prestadorNode = xmlDoc.querySelector('PrestadorServico, prest');
        const tomadorNode = xmlDoc.querySelector('TomadorServico, toma');
        
        data.prestador = getNodeData(prestadorNode);
        data.tomador = getNodeData(tomadorNode);

        data.numeroNfse = querySelectorText(xmlDoc, ['Numero', 'nNFSe']);
        data.discriminacao = querySelectorText(xmlDoc, ['Discriminacao', 'discriminacao', 'xDescricao', 'infCpl']);
        data.itemLc116 = querySelectorText(xmlDoc, ['ItemListaServico', 'cServico']);
        data.valorServicos = parseFloat(querySelectorText(xmlDoc, ['ValorServicos', 'vServ']) || '0');
        data.valorPis = parseFloat(querySelectorText(xmlDoc, ['ValorPis', 'vPIS']) || '0');
        data.valorCofins = parseFloat(querySelectorText(xmlDoc, ['ValorCofins', 'vCOFINS']) || '0');
        data.valorIr = parseFloat(querySelectorText(xmlDoc, ['ValorIr', 'vIR']) || '0');
        data.valorInss = parseFloat(querySelectorText(xmlDoc, ['ValorInss', 'vINSS']) || '0');
        data.valorCsll = parseFloat(querySelectorText(xmlDoc, ['ValorCsll', 'vCSLL']) || '0');
        data.valorLiquido = parseFloat(querySelectorText(xmlDoc, ['ValorLiquidoNfse', 'vLiq', 'vNF']) || '0');
        
    } else {
        // --- NF-e Parsing ---
        const emitNode = xmlDoc.querySelector('emit');
        const destNode = xmlDoc.querySelector('dest');
        
        data.emitente = getNodeData(emitNode);
        data.destinatario = getNodeData(destNode);

        const infNFeNode = xmlDoc.querySelector('infNFe');
        let chave = '';
        if (infNFeNode) {
          chave = infNFeNode.getAttribute('Id') || '';
        }
        if (!chave) {
            chave = querySelectorText(xmlDoc, ['chNFe']);
        }
        data.chaveNfe = chave.replace(/\D/g, '');

        data.valorProdutos = parseFloat(querySelectorText(xmlDoc, ['vProd']) || '0');
        data.valorTotalNota = parseFloat(querySelectorText(xmlDoc, ['vNF']) || '0');

        // Product Parsing
        data.produtos = Array.from(xmlDoc.querySelectorAll('det')).map(det => {
            const prodNode = det.querySelector('prod');
            if (!prodNode) return {};

            return {
                codigo: querySelectorText(prodNode, ['cProd']),
                descricao: querySelectorText(prodNode, ['xProd']),
                ncm: querySelectorText(prodNode, ['NCM']),
                cfop: querySelectorText(prodNode, ['CFOP']),
                valorUnitario: parseFloat(querySelectorText(prodNode, ['vUnCom']) || '0'),
            };
        }).filter(p => p.codigo); // Filter out empty product objects
    }

    return data;
}



export function LaunchFormModal({ isOpen, onClose, xmlFile, launch, manualLaunchType, mode, userId, company, onLaunchSuccess }: LaunchFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<FormData>>({});
  const { toast } = useToast();
  const isReadOnly = mode === 'view';

  const formatCnpj = (cnpj?: string) => {
    if (!cnpj) return '';
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length !== 14) return cnpj; // return original if not a full CNPJ
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  const parseCurrency = (value: string): number => {
    const number = parseFloat(value.replace(/[^0-9,]/g, '').replace(',', '.'));
    return isNaN(number) ? 0 : number;
  };

  const formatDate = (date?: Date): string => {
    if (!date || !isValid(date)) return '';
    try {
        return format(date, 'yyyy-MM-dd');
    } catch {
        return '';
    }
  };
  
  const parseDate = (dateStr: string): Date | null => {
    // Handle yyyy-MM-dd from input type="date"
    const [year, month, day] = dateStr.split('-').map(Number);
    if(year && month && day){
        const date = new Date(year, month - 1, day);
         if (isValid(date)) return date;
    }
    // Fallback for other formats
    const parsed = new Date(dateStr);
    return isValid(parsed) ? parsed : null;
  };

  useEffect(() => {
    let initialData: Partial<FormData> = {};
    if (isOpen) {
      if (mode === 'create') {
        if (xmlFile) {
          initialData = parseXmlAdvanced(xmlFile.content, xmlFile.type);
          initialData.type = xmlFile.type;
          initialData.fileName = xmlFile.file.name;
        } else if (manualLaunchType) {
          initialData = {
            type: manualLaunchType,
            date: new Date(),
            fileName: 'Lançamento Manual',
          };
          // Pre-fill company data for manual launches
          if (manualLaunchType === 'servico') {
            initialData.prestador = { nome: company.razaoSocial, cnpj: company.cnpj };
          } else if (manualLaunchType === 'saida') {
             initialData.emitente = { nome: company.razaoSocial, cnpj: company.cnpj };
          } else if (manualLaunchType === 'entrada') {
             initialData.destinatario = { nome: company.razaoSocial, cnpj: company.cnpj };
          }
        }
      } else if ((mode === 'edit' || mode === 'view') && launch) {
        initialData = { ...launch };
      }
      setFormData(initialData);
    }
  }, [isOpen, xmlFile, launch, manualLaunchType, mode, company]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const [section, field] = name.split('.');

    if (field) { // Nested field like prestador.cnpj
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...(prev[section as keyof typeof prev] as object || {}),
          [field]: value
        }
      }));
    } else { // Top-level field
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

 const handleNumericInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numberValue = parseCurrency(value);
    setFormData(prev => ({ ...prev, [name]: isNaN(numberValue) ? undefined : numberValue }));
 };

 const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const date = parseDate(value);
    if(date) {
        setFormData(prev => ({ ...prev, [name]: date }));
    }
 };


  const handleSubmit = async () => {
    if (mode === 'view') {
        onClose();
        return;
    }
    setLoading(true);

    const getSafeNumber = (value: any): number | null => {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(String(value).replace(/[^0-9,.-]/g, '').replace(',', '.'));
        return isNaN(num) ? null : num;
    };

    const getSafeString = (value: any): string | null => {
      return (value && typeof value === 'string' && value.trim() !== '') ? value.trim() : null
    }

    try {
        const dataToSave: any = {
            fileName: formData.fileName || 'Lançamento Manual',
            type: formData.type || 'desconhecido',
            date: formData.date && isValid(formData.date) ? formData.date : new Date(),
            chaveNfe: getSafeString(formData.chaveNfe),
            numeroNfse: getSafeString(formData.numeroNfse),
            prestador: {
              nome: getSafeString(formData.prestador?.nome),
              cnpj: getSafeString(formData.prestador?.cnpj?.replace(/\D/g, '')),
            },
            tomador: {
              nome: getSafeString(formData.tomador?.nome),
              cnpj: getSafeString(formData.tomador?.cnpj?.replace(/\D/g, '')),
            },
            emitente: {
              nome: getSafeString(formData.emitente?.nome),
              cnpj: getSafeString(formData.emitente?.cnpj?.replace(/\D/g, '')),
            },
            destinatario: {
              nome: getSafeString(formData.destinatario?.nome),
              cnpj: getSafeString(formData.destinatario?.cnpj?.replace(/\D/g, '')),
            },
            discriminacao: getSafeString(formData.discriminacao),
            itemLc116: getSafeString(formData.itemLc116),
            valorServicos: getSafeNumber(formData.valorServicos),
            valorPis: getSafeNumber(formData.valorPis),
            valorCofins: getSafeNumber(formData.valorCofins),
            valorIr: getSafeNumber(formData.valorIr),
            valorInss: getSafeNumber(formData.valorInss),
            valorCsll: getSafeNumber(formData.valorCsll),
            valorLiquido: getSafeNumber(formData.valorLiquido),
            valorProdutos: getSafeNumber(formData.valorProdutos),
            valorTotalNota: getSafeNumber(formData.valorTotalNota),
        };
        
        await launchSchema.parseAsync(dataToSave);
        
        if (formData.produtos && formData.produtos.length > 0) {
            await upsertProductsFromLaunch(userId, company.id, formData.produtos as Produto[]);
        }

        if (mode === 'create') {
            const launchesRef = collection(db, `users/${userId}/companies/${company.id}/launches`);
            delete dataToSave.produtos; // Do not save products inside the launch document
            await addDoc(launchesRef, dataToSave);
            toast({
                title: "Lançamento realizado!",
                description: dataToSave.fileName === 'Lançamento Manual' 
                    ? `Lançamento manual de ${dataToSave.type} criado.`
                    : `O arquivo ${dataToSave.fileName} foi lançado com sucesso.`
            });
            const launchKey = dataToSave.chaveNfe || dataToSave.numeroNfse;
            onLaunchSuccess(launchKey);
        } else if (mode === 'edit' && launch) {
            const launchRef = doc(db, `users/${userId}/companies/${company.id}/launches`, launch.id);
            delete dataToSave.produtos; // Do not save products inside the launch document
            await updateDoc(launchRef, dataToSave);
            toast({
                title: "Lançamento atualizado!",
                description: "As alterações foram salvas com sucesso."
            });
            onClose();
        }

    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error("Zod Error:", error.errors);
            const firstError = error.errors[0];
            toast({
                variant: 'destructive',
                title: `Erro de validação no campo: ${firstError.path.join('.')}`,
                description: firstError.message,
            });
        } else {
            console.error(error);
            toast({
                variant: 'destructive',
                title: "Erro ao Salvar",
                description: "Ocorreu um erro ao salvar os dados. Verifique o console para mais detalhes."
            });
        }
    } finally {
        setLoading(false);
    }
  };
  
  const getTitle = () => {
    switch(mode) {
        case 'create': 
            return xmlFile 
                ? 'Confirmar Lançamento de XML' 
                : `Novo Lançamento Manual`;
        case 'edit': return 'Alterar Lançamento Fiscal';
        case 'view': return 'Visualizar Lançamento Fiscal';
    }
  }
  
  const getInputValue = (name: string) => {
    const [section, field] = name.split('.');
    if (field) {
      const sectionData = formData[section as keyof typeof formData] as any;
      return sectionData?.[field] ?? '';
    }
    const value = formData[name as keyof typeof formData] as any;
    return value ?? '';
  };
  
  const renderNfseFields = () => (
    <Accordion type="multiple" defaultValue={['general', 'service', 'prestador', 'tomador']} className="w-full">
        <AccordionItem value="general">
            <AccordionTrigger>Informações Gerais</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="numeroNfse">Número da NFS-e</Label>
                        <Input id="numeroNfse" name="numeroNfse" value={getInputValue('numeroNfse')} onChange={handleInputChange} readOnly={isReadOnly || !!xmlFile} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="date">Data de Emissão</Label>
                        <Input id="date" name="date" type="date" value={formatDate(formData.date)} onChange={handleDateChange} readOnly={isReadOnly} />
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="prestador">
            <AccordionTrigger>Prestador do Serviço</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="prestador.nome">Razão Social</Label>
                    <Input id="prestador.nome" name="prestador.nome" value={getInputValue('prestador.nome')} onChange={handleInputChange} readOnly={isReadOnly} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="prestador.cnpj">CNPJ</Label>
                    <Input id="prestador.cnpj" name="prestador.cnpj" value={formatCnpj(getInputValue('prestador.cnpj'))} onChange={handleInputChange} readOnly={isReadOnly || !!getInputValue('prestador.cnpj')} />
                </div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="tomador">
            <AccordionTrigger>Tomador do Serviço</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="tomador.nome">Razão Social</Label>
                    <Input id="tomador.nome" name="tomador.nome" value={getInputValue('tomador.nome')} onChange={handleInputChange} readOnly={isReadOnly} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tomador.cnpj">CNPJ</Label>
                    <Input id="tomador.cnpj" name="tomador.cnpj" value={formatCnpj(getInputValue('tomador.cnpj'))} onChange={handleInputChange} readOnly={isReadOnly || !!getInputValue('tomador.cnpj')} />
                </div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="service">
            <AccordionTrigger>Serviços e Impostos</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="discriminacao">Discriminação do Serviço</Label>
                    <Textarea id="discriminacao" name="discriminacao" value={getInputValue('discriminacao')} onChange={handleInputChange} readOnly={isReadOnly} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="itemLc116">Item LC 116</Label>
                        <Input id="itemLc116" name="itemLc116" value={getInputValue('itemLc116')} onChange={handleInputChange} readOnly={isReadOnly} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="valorServicos">Valor dos Serviços</Label>
                        <Input id="valorServicos" name="valorServicos" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorServicos') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="valorPis">PIS</Label>
                        <Input id="valorPis" name="valorPis" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorPis') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="valorCofins">COFINS</Label>
                        <Input id="valorCofins" name="valorCofins" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorCofins') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="valorCsll">CSLL</Label>
                        <Input id="valorCsll" name="valorCsll" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorCsll') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="valorInss">INSS</Label>
                        <Input id="valorInss" name="valorInss" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorInss') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="valorIr">IR</Label>
                        <Input id="valorIr" name="valorIr" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorIr') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="valorLiquido" className="font-bold">Valor Líquido</Label>
                        <Input id="valorLiquido" name="valorLiquido" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorLiquido') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} className="font-bold" />
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    </Accordion>
  );

  const renderNfeFields = () => (
    <Accordion type="multiple" defaultValue={['general', 'emitter', 'recipient', 'products']} className="w-full">
        <AccordionItem value="general">
            <AccordionTrigger>Informações Gerais</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="chaveNfe">Chave da NF-e</Label>
                    <Input id="chaveNfe" name="chaveNfe" value={getInputValue('chaveNfe')} onChange={handleInputChange} readOnly={isReadOnly || !!xmlFile} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="date">Data de Emissão</Label>
                        <Input id="date" name="date" type="date" value={formatDate(formData.date)} onChange={handleDateChange} readOnly={isReadOnly} />
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="emitter">
            <AccordionTrigger>Emitente</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="emitente.nome">Razão Social</Label>
                    <Input id="emitente.nome" name="emitente.nome" value={getInputValue('emitente.nome')} onChange={handleInputChange} readOnly={isReadOnly} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="emitente.cnpj">CNPJ</Label>
                    <Input id="emitente.cnpj" name="emitente.cnpj" value={formatCnpj(getInputValue('emitente.cnpj'))} onChange={handleInputChange} readOnly={isReadOnly || !!getInputValue('emitente.cnpj')} />
                </div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="recipient">
            <AccordionTrigger>Destinatário</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                 <div className="space-y-2">
                    <Label htmlFor="destinatario.nome">Razão Social</Label>
                    <Input id="destinatario.nome" name="destinatario.nome" value={getInputValue('destinatario.nome')} onChange={handleInputChange} readOnly={isReadOnly} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="destinatario.cnpj">CNPJ</Label>
                    <Input id="destinatario.cnpj" name="destinatario.cnpj" value={formatCnpj(getInputValue('destinatario.cnpj'))} onChange={handleInputChange} readOnly={isReadOnly || !!getInputValue('destinatario.cnpj')} />
                </div>
            </AccordionContent>
        </AccordionItem>
         <AccordionItem value="products">
            <AccordionTrigger>Produtos e Valores</AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="valorProdutos">Valor dos Produtos</Label>
                        <Input id="valorProdutos" name="valorProdutos" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorProdutos') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="valorTotalNota" className="font-bold">Valor Total da Nota</Label>
                        <Input id="valorTotalNota" name="valorTotalNota" value={new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2 }).format(getInputValue('valorTotalNota') || 0)} onChange={handleNumericInputChange} readOnly={isReadOnly} className="font-bold" />
                    </div>
                </div>
                 {formData.produtos && formData.produtos.length > 0 && (
                    <div className="mt-4 space-y-2">
                        <h4 className="font-semibold text-sm">Itens do XML</h4>
                        <div className="border rounded-md max-h-48 overflow-y-auto">
                            {formData.produtos.map((p, i) => (
                                <div key={i} className="text-xs p-2 border-b last:border-b-0">
                                    <p className="font-medium truncate">{p.codigo} - {p.descricao}</p>
                                    <p className="text-muted-foreground">NCM: {p.ncm} | CFOP: {p.cfop} | V. Unit: {new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(p.valorUnitario || 0)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
            </AccordionContent>
        </AccordionItem>
    </Accordion>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
           <DialogDescription asChild>
            <div>
              <div className="flex items-center gap-2">
                  <span>Tipo:</span>
                  <Badge variant="secondary" className="text-base capitalize">{formData.type}</Badge>
              </div>
              {xmlFile && <p>Arquivo: <span className="font-semibold">{xmlFile.file.name}</span></p>}
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[70vh] overflow-y-auto pr-4">
          {formData.type === 'servico' ? (
            renderNfseFields()
          ) : (
            renderNfeFields()
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {mode === 'view' ? 'Fechar' : 'Cancelar'}
          </Button>
          {mode !== 'view' && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? 'Confirmar Lançamento' : 'Salvar Alterações'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
