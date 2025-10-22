
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, getDocs, where, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileStack, ArrowUpRightSquare, ArrowDownLeftSquare, FileText, Upload, FileUp, Check, Loader2, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, FilterX, Calendar as CalendarIcon, Search, FileX as FileXIcon, Lock, ClipboardList, Calculator, FileSignature, MoreHorizontal, Send, Scale, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { LaunchFormModal, type OpenModalOptions } from "@/components/fiscal/launch-form-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FiscalClosingModal } from "@/components/fiscal/fiscal-closing-modal";
import Link from "next/link";
import type { Orcamento } from '@/types/orcamento';
import { generateLaunchPdf } from "@/services/launch-report-service";
import type { Partner } from "@/types/partner";
import type { Produto } from '@/types/produto';
import type { Servico } from '@/types/servico';
import { XmlFile, Launch, Company } from "@/types";

// Helper to safely stringify with support for File objects
function replacer(key: string, value: any) {
  if (typeof File !== 'undefined' && value instanceof File) {
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
  if (typeof File !== 'undefined' && value && value._type === 'File') {
    // We can't recreate the file content, but we can recreate the object structure
    // This is sufficient for display and state management purposes
    return new File([], value.name, { type: value.type, lastModified: value.lastModified });
  }
  return value;
}


export default function FiscalPage() {
  const [xmlFiles, setXmlFiles] = useState<XmlFile[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  
  const [modalOptions, setModalOptions] = useState<OpenModalOptions | null>(null);
  
  // Data for modals
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Produto[]>([]);
  const [services, setServices] = useState<Servico[]>([]);
  
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

  const fileInputRef = React.useRef<HTMLInputElement>(null);
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
            try {
                const storedFiles = sessionStorage.getItem(`xmlFiles_${companyId}`);
                if (storedFiles) {
                    setXmlFiles(JSON.parse(storedFiles, reviver));
                }
            } catch (e) {
                console.error("Failed to parse stored XML files:", e);
                sessionStorage.removeItem(`xmlFiles_${companyId}`);
            }
        }
    }
  }, [user]);

  useEffect(() => {
    if (activeCompany) {
       try {
        sessionStorage.setItem(`xmlFiles_${activeCompany.id}`, JSON.stringify(xmlFiles, replacer));
       } catch(e) {
          console.error("Failed to save XML files to session storage:", e);
       }
    }
  }, [xmlFiles, activeCompany]);

  useEffect(() => {
    if (!activeCompany || !user) {
        setLoadingData(false);
        setLaunches([]);
        setOrcamentos([]);
        setClosedPeriods([]);
        setPartners([]);
        setProducts([]);
        setServices([]);
        return;
    };

    setLoadingData(true);
    let activeListeners = 6;
    const onDone = () => {
        activeListeners--;
        if (activeListeners === 0) setLoadingData(false);
    }
    
    // Generic function to create a listener
    const createListener = (collectionName: string, setData: (data: any[]) => void, toastTitle: string, orderByField: string = 'date') => {
        const ref = collection(db, `users/${user.uid}/companies/${activeCompany.id}/${collectionName}`);
        const q = query(ref, orderBy(orderByField, 'desc'));

        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const docData = doc.data();
                // Convert all known timestamp fields to Date objects
                const dateFields = ['date', 'createdAt', 'dataAdmissao', 'dataNascimento', 'startDate', 'terminationDate'];
                for(const field of dateFields) {
                    if (docData[field] instanceof Timestamp) {
                        docData[field] = docData[field].toDate();
                    }
                }
                return { id: doc.id, ...docData };
            });
            setData(data);
            onDone();
        }, (error) => {
            console.error(`Error fetching ${collectionName}: `, error);
            toast({ variant: "destructive", title: toastTitle });
            onDone();
        });
    };

    const unsubscribes = [
      createListener('launches', setLaunches, "Erro ao buscar lançamentos", "date"),
      createListener('orcamentos', setOrcamentos, "Erro ao buscar orçamentos", "createdAt"),
      createListener('partners', setPartners, "Erro ao buscar parceiros", "razaoSocial"),
      createListener('produtos', setProducts, "Erro ao buscar produtos", "descricao"),
      createListener('servicos', setServices, "Erro ao buscar serviços", "descricao"),
      
      // Listener for fiscal closures
      onSnapshot(collection(db, `users/${user.uid}/companies/${activeCompany.id}/fiscalClosures`), (snapshot) => {
        const periods = snapshot.docs.map(doc => doc.id);
        setClosedPeriods(periods);
        onDone();
      }, (error) => { console.error("Error fetching closures: ", error); toast({ variant: "destructive", title: "Erro ao buscar períodos fechados" }); onDone(); })
    ];


    return () => {
        unsubscribes.forEach(unsub => unsub());
    };
  }, [activeCompany, user, toast]);

  const refreshXmlFileStatus = useCallback(() => {
    if (launches.length === 0) {
        // If there are no launches, all files must be pending
        setXmlFiles(prevFiles => prevFiles.map(f => ({ ...f, status: 'pending' })));
        return;
    }

    const launchedItems = new Map<string, { valor: number, status: string }>();
    launches.forEach(launch => {
        const key = launch.chaveNfe || `${launch.numeroNfse}-${launch.codigoVerificacaoNfse}-${launch.versaoNfse}`;
        if (key) {
            launchedItems.set(key, {
                valor: launch.valorTotalNota || launch.valorLiquido || 0,
                status: launch.status || 'Normal',
            });
        }
    });

    setXmlFiles(prevFiles => prevFiles.map(file => {
        if (!file.key) return file; // Cannot check status without a key

        const existingLaunch = launchedItems.get(file.key);
        let newStatus: XmlFile['status'] = file.status;

        if (existingLaunch) {
            // It's considered 'launched' if it exists and status is Normal
            if (existingLaunch.status === 'Normal') {
                 newStatus = 'launched';
            }
        } else {
             // If it's not in the launched list, it should be pending (unless it was cancelled)
            if (file.status === 'launched') {
                 newStatus = 'pending';
            }
        }
        return { ...file, status: newStatus };
    }));
    toast({ title: 'Lista de XMLs atualizada!'})

  }, [launches]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !user || !activeCompany) return;

    const files = Array.from(event.target.files).filter(
        (file) => file.type === 'text/xml' || file.name.endsWith('.xml')
    );
    if (files.length === 0) return;

    const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/launches`);
    const existingLaunchesSnap = await getDocs(launchesRef);
    const launchedItems = new Map<string, { valor: number, status: string }>();
    existingLaunchesSnap.docs.forEach(doc => {
      const data = doc.data();
      const key = data.chaveNfe || `${data.numeroNfse}-${data.codigoVerificacaoNfse}-${data.versaoNfse}`;
      if(key) {
        launchedItems.set(key, { 
            valor: data.valorTotalNota || data.valorLiquido || 0,
            status: data.status || 'Normal',
         });
      }
    });
    
    const newFilesPromises = files.map(async (file): Promise<XmlFile | null> => {
        const fileContent = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fileContent, 'text/xml');
        const normalizedActiveCnpj = activeCompany.cnpj?.replace(/\D/g, '');

        let type: XmlFile['type'] = 'desconhecido';
        let status: XmlFile['status'] = 'pending';
        let key: string | undefined = undefined;

        const getCnpjCpfFromNode = (node: Element | null, selectors: string[]): string | null => {
            if (!node) return null;
            for (const selector of selectors) {
                const el = node.querySelector(selector);
                if (el?.textContent) {
                    return el.textContent.replace(/\D/g, '');
                }
            }
            return null;
        };

        const isNFe = xmlDoc.querySelector('infNFe');
        const isNfsePadrao = xmlDoc.querySelector('CompNfse, NFSe');
        const isNfseAbrasf = xmlDoc.querySelector('ConsultarNfseServicoPrestadoResposta');
        const isCancelled = xmlDoc.querySelector('procCancNFe, cancNFe');

        let nfseVersion = '';
        let fileValue = 0;

        if (isCancelled) {
            type = 'cancelamento';
            status = 'cancelled';
        } else if (isNFe) {
            const emitCnpj = getCnpjCpfFromNode(isNFe.querySelector('emit'), ['CNPJ', 'CPF']);
            const destCnpj = getCnpjCpfFromNode(isNFe.querySelector('dest'), ['CNPJ', 'CPF']);
            
            key = (isNFe.getAttribute('Id') || '').replace('NFe', '');
            fileValue = parseFloat(xmlDoc.querySelector('vNF')?.textContent || '0');
            
            if (emitCnpj === normalizedActiveCnpj) type = 'saida';
            else if (destCnpj === normalizedActiveCnpj) type = 'entrada';

        } else if (isNfsePadrao || isNfseAbrasf) {
            const nfseNode = xmlDoc.querySelector('Nfse, NFSe');
            nfseVersion = nfseNode?.getAttribute('versao') || xmlDoc.querySelector('CompNfse')?.getAttribute('versao') || '2.04';
            
            const serviceNode = xmlDoc.querySelector('InfNfse') || xmlDoc.querySelector('InfDeclaracaoPrestacaoServico') || nfseNode;
            const declaracaoServicoNode = xmlDoc.querySelector('DeclaracaoPrestacaoServico > InfDeclaracaoPrestacaoServico') || serviceNode;

            if (serviceNode) {
                const prestadorCnpj = getCnpjCpfFromNode(declaracaoServicoNode, ['PrestadorServico > CpfCnpj > Cnpj', 'Prestador > CpfCnpj > Cnpj', 'prest > CNPJ']);
                const tomadorNode = serviceNode.querySelector('TomadorServico, Tomador') || declaracaoServicoNode.querySelector('TomadorServico, Tomador') || declaracaoServicoNode;
                const tomadorCnpj = tomadorNode ? getCnpjCpfFromNode(tomadorNode, ['IdentificacaoTomador > CpfCnpj > Cnpj', 'CpfCnpj > Cnpj', 'TomadorServico > IdentificacaoTomador > CpfCnpj > Cnpj']) : null;
                
                const numeroNfse = (serviceNode.querySelector('Numero') || xmlDoc.querySelector('Numero'))?.textContent;
                const codigoVerificacao = (serviceNode.querySelector('CodigoVerificacao'))?.textContent;
                key = `${numeroNfse}-${codigoVerificacao}-${nfseVersion}`;
                fileValue = parseFloat(xmlDoc.querySelector('ValorLiquidoNfse, vLiq, vNF')?.textContent || '0');

                if (prestadorCnpj === normalizedActiveCnpj) type = 'servico';
                else if (tomadorCnpj === normalizedActiveCnpj) type = 'entrada';
            }
        }

        if(key) {
            const existingLaunch = launchedItems.get(key);
            if (existingLaunch) {
                 if (Math.abs(existingLaunch.valor - fileValue) < 0.01 && existingLaunch.status !== 'Substituida') {
                    status = 'launched';
                 }
            }
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
        return { file: fileData, content: fileContent, status, type, key, versaoNfse: nfseVersion };
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
  
  const handleLaunchSuccess = async (launchedKey: string, status: Launch['status']) => {
     if (launchedKey) {
        const launchedLaunch = launches.find(l => (l.chaveNfe || `${l.numeroNfse}-${l.codigoVerificacaoNfse}-${l.versaoNfse}`) === launchedKey);
        const newValue = launchedLaunch?.valorTotalNota || launchedLaunch?.valorLiquido || 0;

        // Check for an older version of this launch and mark it as 'Substituida'
        const oldLaunch = Array.from(launches.values()).find(l => 
            (l.chaveNfe || `${l.numeroNfse}-${l.codigoVerificacaoNfse}-${l.versaoNfse}`) === launchedKey &&
            l.id !== launchedLaunch?.id
        );
        
        if (oldLaunch && Math.abs((oldLaunch.valorTotalNota || oldLaunch.valorLiquido || 0) - newValue) > 0.01) {
            const launchRef = doc(db, `users/${user!.uid}/companies/${activeCompany!.id}/launches`, oldLaunch.id);
            await updateDoc(launchRef, { status: 'Substituida' });
        }


        setXmlFiles(files => files.map(f => {
            if (f.key === launchedKey) {
                return { ...f, status: status === 'Cancelado' ? 'cancelled' : 'launched' };
            }
            return f;
        }));
     }
  }

  const handleDeleteLaunch = async (launch: Launch) => {
    if (!user || !activeCompany) return;
    try {
        const launchRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/launches`, launch.id);
        await deleteDoc(launchRef);
        
        const keyToMatch = launch.chaveNfe || `${launch.numeroNfse}-${launch.codigoVerificacaoNfse}-${launch.versaoNfse}`;
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
  
  const handleDeleteOrcamento = async (id: string) => {
     if (!user || !activeCompany) return;
     try {
         await deleteDoc(doc(db, `users/${user.uid}/companies/${activeCompany.id}/orcamentos`, id));
         toast({ title: "Orçamento excluído com sucesso." });
     } catch (error) {
        toast({ variant: "destructive", title: "Erro ao excluir orçamento." });
     }
  }

  const handleGeneratePdf = (launch: Launch) => {
    if (!activeCompany) {
      toast({ variant: 'destructive', title: 'Empresa não selecionada' });
      return;
    }
    try {
      generateLaunchPdf(activeCompany, launch);
    } catch (error) {
       toast({ variant: 'destructive', title: 'Erro ao gerar PDF', description: (error as Error).message });
    }
  }
  
  const openModal = useCallback(async (options: OpenModalOptions) => {
     if (options.xmlFile && user && activeCompany) {
        const { xmlFile } = options;
        if (xmlFile.key) {
             const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompany.id}/launches`);
             let q;
             if (xmlFile.type === 'servico' || xmlFile.type === 'entrada') {
                 const [numero, codigo, versao] = xmlFile.key.split('-');
                 q = query(launchesRef, where("numeroNfse", "==", numero), where("codigoVerificacaoNfse", "==", codigo), where("versaoNfse", "==", versao));
             } else {
                 q = query(launchesRef, where("chaveNfe", "==", xmlFile.key));
             }
             
             const querySnapshot = await getDocs(q);
             
             if (!querySnapshot.empty) {
                const existingLaunch = querySnapshot.docs[0].data() as Launch;
                const xmlValue = parseFloat(xmlFile.content.match(/<(?:vNF|ValorLiquidoNfse|vLiq)>(\d+\.\d+)<\/(?:vNF|ValorLiquidoNfse|vLiq)>/)?.[1] || '0');
                const launchedValue = existingLaunch.valorTotalNota || existingLaunch.valorLiquido || 0;

                if (Math.abs(xmlValue - launchedValue) < 0.01 && existingLaunch.status !== 'Substituida') {
                    toast({
                        variant: "destructive",
                        title: "Nota Já Lançada",
                        description: "Esta nota fiscal já foi lançada no sistema.",
                    });
                    setXmlFiles(files => files.map(f => f.key === xmlFile.key ? { ...f, status: 'launched' } : f));
                    return; 
                } else {
                    // This is a substitute note, allow launching but maybe warn user or handle specially
                    options.launch = { ...existingLaunch, id: querySnapshot.docs[0].id };
                    options.mode = 'edit';
                }
             }
        }
    }
    setModalOptions(options);
  }, [user, activeCompany, toast, launches]);

  const closeModal = useCallback(() => {
    setModalOptions(null);
  }, []);

  const renderedModal = useMemo(() => {
    if (!modalOptions) return null;
    return (
      <LaunchFormModal 
        isOpen={!!modalOptions}
        onClose={closeModal}
        initialData={modalOptions}
        userId={user!.uid}
        company={activeCompany!}
        onLaunchSuccess={handleLaunchSuccess}
        partners={partners}
        products={products}
        services={services}
      />
    );
  }, [modalOptions, closeModal, user, activeCompany, handleLaunchSuccess, partners, products, services]);


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
          <Button onClick={() => openModal({ manualLaunchType: 'saida', mode: 'create' })}><ArrowUpRightSquare className="mr-2 h-4 w-4" /> Lançar Nota de Saída</Button>
          <Button onClick={() => openModal({ manualLaunchType: 'entrada', mode: 'create' })} className="bg-green-100 text-green-800 hover:bg-green-200"><ArrowDownLeftSquare className="mr-2 h-4 w-4" /> Lançar Nota de Entrada</Button>
          <Button onClick={() => openModal({ manualLaunchType: 'servico', mode: 'create' })} className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200"><FileText className="mr-2 h-4 w-4" /> Lançar Nota de Serviço</Button>
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
           <Button asChild className="bg-cyan-100 text-cyan-800 hover:bg-cyan-200">
             <Link href="/fiscal/orcamento">
                <FileSignature className="mr-2 h-4 w-4" /> Gerar Orçamento
             </Link>
          </Button>
          <Button asChild className="bg-sky-100 text-sky-800 hover:bg-sky-200">
             <Link href="/fiscal/apuracao">
                <Scale className="mr-2 h-4 w-4" /> Apuração de Impostos
             </Link>
          </Button>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Orçamentos Recentes</CardTitle>
            <CardDescription>Visualize e gerencie os orçamentos criados.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
                 <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : orcamentos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FileSignature className="h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold">Nenhum orçamento encontrado</h3>
                  <p className="text-muted-foreground mt-2">Clique em "Gerar Orçamento" para começar.</p>
                </div>
            ) : (
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nº</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orcamentos.slice(0, 5).map(orc => (
                            <TableRow key={orc.id}>
                                <TableCell className="font-mono">{String(orc.quoteNumber).padStart(4, '0')}</TableCell>
                                <TableCell>{format(orc.createdAt as Date, 'dd/MM/yyyy')}</TableCell>
                                <TableCell>{orc.partnerName}</TableCell>
                                <TableCell className="text-right font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orc.total)}</TableCell>
                                 <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild><Link href={`/fiscal/orcamento?id=${orc.id}`}><Eye className="mr-2 h-4 w-4" /> Visualizar / Editar</Link></DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openModal({ orcamento: orc, mode: 'create' })}><Send className="mr-2 h-4 w-4 text-green-600"/> Gerar Lançamento Fiscal</DropdownMenuItem>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/> Excluir</DropdownMenuItem></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteOrcamento(orc.id!)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
                        <SelectTrigger className="w-full sm:w-[120px]">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="entrada">Entrada</SelectItem>
                            <SelectItem value="saida">Saída</SelectItem>
                            <SelectItem value="servico">Serviço</SelectItem>
                            <SelectItem value="cancelamento">Cancelamento</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={xmlStatusFilter} onValueChange={setXmlStatusFilter}>
                        <SelectTrigger className="w-full sm:w-[120px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="launched">Lançado</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="ghost" onClick={clearXmlFilters}>
                        <FilterX className="mr-2 h-4 w-4" />
                        Limpar
                    </Button>
                    <Button variant="outline" onClick={refreshXmlFileStatus} className="sm:ml-auto">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Atualizar
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
                            <Button size="sm" onClick={() => openModal({ xmlFile, mode: 'create' })} disabled={xmlFile.status !== 'pending'}>
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
      </div>

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
                                            <DropdownMenuItem onClick={() => handleGeneratePdf(launch)}>
                                                <FileText className="mr-2 h-4 w-4" />
                                                Visualizar PDF
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openModal({ launch, mode: 'view' })}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Visualizar Detalhes
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openModal({ launch, mode: 'edit' })}>
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
      
      {modalOptions && user && activeCompany && renderedModal}
      
      {modalOptions === null && user && activeCompany && (
        <FiscalClosingModal
            isOpen={false}
            onClose={() => {}}
            userId={user.uid}
            companyId={activeCompany.id}
        />
      )}
    </div>
  );
}

    