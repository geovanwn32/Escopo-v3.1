

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, deleteDoc, doc, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileStack, ArrowUpRightSquare, ArrowDownLeftSquare, FileText, Upload, FileUp, Check, Loader2, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, FilterX, Calendar as CalendarIcon, Search, FileX as FileXIcon, Lock, ClipboardList, Calculator } from "lucide-react";
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
import { FiscalClosingModal } from "@/components/fiscal/fiscal-closing-modal";
import Link from "next/link";

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
    status: 'Normal' | 'Cancelado' | 'Substituida';
    date: Date;
    chaveNfe?: string;
    numeroNfse?: string;
    financialStatus?: 'pendente' | 'pago' | 'vencido';
    
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
  const [closedPeriods, setClosedPeriods] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosingModalOpen, setClosingModalOpen] = useState(false);
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
  const launchesItemsPerPage = 10;


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
        setLoadingData(false);
        setLaunches([]);
        setClosedPeriods([]);
        return;
    };

    setLoadingData(true);
    let activeListeners = 2;
    const onDone = () => {
        activeListeners--;
        if (activeListeners === 0) setLoadingData(false);
    }
    
    // Listener for launches
    const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/launches`);
    const qLaunches = query(launchesRef, orderBy('date', 'desc'));
    const unsubscribeLaunches = onSnapshot(qLaunches, (snapshot) => {
        const launchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate() } as Launch));
        setLaunches(launchesData);
        onDone();
    }, (error) => { console.error("Error fetching launches: ", error); toast({ variant: "destructive", title: "Erro ao buscar lançamentos" }); onDone(); });

    // Listener for fiscal closures
    const closuresRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/fiscalClosures`);
    const unsubscribeClosures = onSnapshot(closuresRef, (snapshot) => {
        const periods = snapshot.docs.map(doc => doc.id); // doc.id is 'YYYY-MM'
        setClosedPeriods(periods);
        onDone();
    }, (error) => { console.error("Error fetching closures: ", error); toast({ variant: "destructive", title: "Erro ao buscar períodos fechados" }); onDone(); });


    return () => {
        unsubscribeLaunches();
        unsubscribeClosures();
    };
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
    const launchedKeys = new Set(existingLaunchesSnap.docs.map(doc => doc.data().chaveNfe || doc.data().numeroNfse).filter(Boolean));
    
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
            
            key = (isNFe.getAttribute('Id') || '').replace('NFe', '');
            if (launchedKeys.has(key)) status = 'launched';

            if (emitCnpj === normalizedActiveCnpj) type = 'saida';
            else if (destCnpj === normalizedActiveCnpj) type = 'entrada';

        } else if (isNFSe) {
            const prestadorNode = xmlDoc.querySelector('PrestadorServico, prest');
            const tomadorNode = xmlDoc.querySelector('TomadorServico, toma');
            
            const prestadorCnpj = getCnpjCpfFromNode(prestadorNode);
            const tomadorCnpj = getCnpjCpfFromNode(tomadorNode);
            const numeroNfse = xmlDoc.querySelector('Numero, nNFSe')?.textContent;
            
            key = numeroNfse || undefined;
            if (key && launchedKeys.has(key)) status = 'launched';

            if (prestadorCnpj === normalizedActiveCnpj) type = 'servico';
            else if (tomadorCnpj === normalizedActiveCnpj) type = 'saida'; // NFS-e can be an 'expense' as well
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

  const handleLaunchSuccess = (launchedKey: string, status: Launch['status']) => {
     if (launchedKey) {
        setXmlFiles(files => files.map(f => {
            if (f.key === launchedKey) {
                return { ...f, status: status === 'Cancelado' ? 'cancelled' : 'launched' };
            }
            return f;
        }));
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
  
  const getBadgeForLaunchStatus = (status: Launch['status']) => {
    switch (status) {
        case 'Normal':
            return <Badge className="bg-green-600 hover:bg-green-700">{status}</Badge>;
        case 'Cancelado':
            return <Badge variant="destructive">{status}</Badge>;
        case 'Substituida':
            return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">{status}</Badge>;
        default:
            return <Badge variant="secondary">{status}</Badge>;
    }
  }

  const isLaunchLocked = (launch: Launch): boolean => {
    const launchPeriod = format(launch.date, 'yyyy-MM');
    return closedPeriods.includes(launchPeriod);
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
           <Button asChild className="bg-purple-100 text-purple-800 hover:bg-purple-200">
             <Link href="/fiscal/inventario">
                <ClipboardList className="mr-2 h-4 w-4" /> Processar Inventário
             </Link>
          </Button>
          <Button asChild className="bg-teal-100 text-teal-800 hover:bg-teal-200">
             <Link href="/fiscal/calculo-inventario">
                <Calculator className="mr-2 h-4 w-4" /> Calcular Inventário
             </Link>
          </Button>
          <Button className="bg-blue-100 text-blue-800 hover:bg-blue-200" onClick={() => setClosingModalOpen(true)}>
            <Lock className="mr-2 h-4 w-4" /> Realizar Fechamento Fiscal
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
                {paginatedXmlFiles.length > 0 ? paginatedXmlFiles.map((xmlFile, index) => (
                  <TableRow key={`${xmlFile.file.name}-${index}`}>
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
                            Lançar
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
            {loadingData ? (
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
                            <TableHead>Arquivo XML</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedLaunches.length === 0 ? (
                             <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    Nenhum resultado encontrado para os filtros aplicados.
                                </TableCell>
                            </TableRow>
                        ) : paginatedLaunches.map(launch => (
                            <TableRow key={launch.id} className={cn(isLaunchLocked(launch) && 'bg-muted/30 hover:bg-muted/50')}>
                                <TableCell>{new Intl.DateTimeFormat('pt-BR').format(launch.date)}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary">
                                      {launch.type.charAt(0).toUpperCase() + launch.type.slice(1)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                    {getPartnerName(launch)}
                                </TableCell>
                                <TableCell className="font-mono text-xs max-w-[150px] truncate" title={launch.chaveNfe || launch.numeroNfse}>
                                    {launch.chaveNfe || launch.numeroNfse}
                                </TableCell>
                                <TableCell className="font-mono text-xs max-w-[150px] truncate">{launch.fileName}</TableCell>
                                <TableCell>
                                    {getBadgeForLaunchStatus(launch.status)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(launch.valorLiquido || launch.valorTotalNota || 0)}
                                </TableCell>
                                <TableCell className="text-right">
                                    {isLaunchLocked(launch) ? (
                                        <Lock className="h-4 w-4 mx-auto text-muted-foreground" title="Este período está fechado"/>
                                    ) : (
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
                                    )}
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
      {isClosingModalOpen && user && activeCompany && (
        <FiscalClosingModal
            isOpen={isClosingModalOpen}
            onClose={() => setClosingModalOpen(false)}
            userId={user.uid}
            companyId={activeCompany.id}
        />
      )}
    </div>
  );
}



