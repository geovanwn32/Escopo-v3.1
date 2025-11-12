
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, getDocs, where, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase.tsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileStack, ArrowUpRightSquare, ArrowDownLeftSquare, FileText, Upload, FileUp, Check, Loader2, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, FilterX, Search, FileX as FileXIcon, Lock, ClipboardList, Calculator, FileSignature, MoreHorizontal, Send, Scale, RefreshCw, Landmark, ShoppingCart, BarChart as RechartsIcon, TrendingUp, Building, BarChart3, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { LaunchFormModal, OpenModalOptions } from "@/components/fiscal/launch-form-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from "react-day-picker";
import { format, isValid, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FiscalClosingModal } from "@/components/fiscal/fiscal-closing-modal";
import Link from "next/link";
import type { Orcamento } from '@/types/orcamento';
import { generateLaunchPdf } from "@/services/launch-report-service";
import type { Partner } from '@/types/partner';
import type { Produto } from '@/types/produto';
import type { Servico } from '@/types/servico';
import type { Employee } from '@/types/employee';
import { XmlFile, Launch, Company, Recibo } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ReceiptFormModal, ReceiptModalOptions } from "@/components/fiscal/receipt-form-modal";
import { useRouter } from 'next/navigation';
import { AnnualReportModal } from "@/components/fiscal/annual-report-modal";
import { DateRangePicker } from "@/components/ui/date-range-picker";


export type GenericLaunch = (Launch & { docType: 'launch' }) | (Recibo & { docType: 'recibo' });

const getPartnerName = (item: GenericLaunch, company: Company | null): string => {
    if (item.docType === 'recibo') {
        return item.pagadorNome;
    }
    
    // For 'entrada' (Serviço Tomado or NF-e de Compra), the partner is the provider/emitter.
    if (item.type === 'entrada') {
      return item.prestador?.nome || item.emitente?.nome || 'N/A';
    }

    // For 'saida' (NF-e de Venda) or 'servico' (Serviço Prestado), the partner is the recipient/tomador.
    if (item.type === 'saida') return item.destinatario?.nome || 'N/A';
    if (item.type === 'servico') return item.tomador?.nome || 'N/A';

    return 'N/A';
};
  
const getLaunchValue = (item: GenericLaunch): number => {
    if (item.docType === 'recibo') return item.valor;
    return item.valorLiquido || item.valorTotalNota || 0;
};
  
const getLaunchDocRef = (item: GenericLaunch): string => {
    if (item.docType === 'recibo') return String(item.numero);
    return item.numeroNfse || item.chaveNfe || 'N/A';
};

const getBadgeForLaunchType = (item: GenericLaunch) => {
    if (item.docType === 'recibo') {
        const variant = item.natureza === 'receita' ? 'success' : 'destructive';
        const label = item.natureza === 'receita' ? 'Receita' : 'Despesa';
        return <Badge className="capitalize" variant={variant}>{item.tipo} {label}</Badge>
    }
    switch (item.type) {
        case 'entrada': return <Badge className="capitalize bg-red-100 text-red-800">{item.type}</Badge>;
        case 'saida': return <Badge className="capitalize bg-blue-100 text-blue-800">{item.type}</Badge>;
        case 'servico': return <Badge className="capitalize bg-yellow-100 text-yellow-800">{item.type}</Badge>;
        default: return <Badge variant="secondary" className="capitalize">{item.type}</Badge>;
    }
}
  
const getBadgeForLaunchStatus = (status: Launch['status']) => {
    if (!status) return <Badge variant="secondary">Normal</Badge>;
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
    return new File([], value.name, { type: value.type, lastModified: value.lastModified });
  }
  return value;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];



const MemoizedLaunchFormModal = React.memo(LaunchFormModal);
const MemoizedReceiptFormModal = React.memo(ReceiptFormModal);


export default function FiscalPage() {
  const [xmlFiles, setXmlFiles] = useState<XmlFile[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [currentLaunchModalData, setCurrentLaunchModalData] = useState<OpenModalOptions | null>(null);
  
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [currentReceiptModalData, setCurrentReceiptModalData] = useState<ReceiptModalOptions | null>(null);

  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [isAnnualReportModalOpen, setAnnualReportModalOpen] = useState(false);
  
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Produto[]>([]);
  const [services, setServices] = useState<Servico[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const [xmlNameFilter, setXmlNameFilter] = useState("");
  const [xmlTypeFilter, setXmlTypeFilter] = useState("");
  const [xmlStatusFilter, setXmlStatusFilter] = useState("");
  const [xmlCurrentPage, setXmlCurrentPage] = useState(1);
  const xmlItemsPerPage = 5;

  const [filterKey, setFilterKey] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDate, setFilterDate] = useState<DateRange | undefined>(undefined);
  const [launchesCurrentPage, setLaunchesCurrentPage] = useState(1);
  const launchesItemsPerPage = 10;

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  
  const openLaunchModal = useCallback((options: OpenModalOptions) => {
    setCurrentLaunchModalData(options);
    setIsLaunchModalOpen(true);
  }, []);

  const closeLaunchModal = useCallback(() => {
    setIsLaunchModalOpen(false);
    setCurrentLaunchModalData(null);
  }, []);
  
  const openReceiptModal = useCallback((options: ReceiptModalOptions) => {
    setCurrentReceiptModalData(options);
    setIsReceiptModalOpen(true);
  }, []);

  const closeReceiptModal = useCallback(() => {
    setIsReceiptModalOpen(false);
    setCurrentReceiptModalData(null);
  }, []);


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
    if (!user || !activeCompany) {
        setLoadingData(false);
        return;
    }

    setLoadingData(true);
    const companyPath = `users/${user.uid}/companies/${activeCompany.id}`;

    const collectionsToFetch = [
        { name: 'launches', setter: setLaunches, orderByField: 'date' },
        { name: 'recibos', setter: setRecibos, orderByField: 'data' },
        { name: 'orcamentos', setter: setOrcamentos, orderByField: 'createdAt' },
        { name: 'partners', setter: setPartners, orderByField: 'razaoSocial' },
        { name: 'produtos', setter: setProducts, orderByField: 'descricao' },
        { name: 'servicos', setter: setServices, orderByField: 'descricao' },
        { name: 'employees', setter: setEmployees, orderByField: 'nomeCompleto' },
    ];
    
    let activeListeners = collectionsToFetch.length + 1; // +1 for closures
    
    const onDone = () => {
        activeListeners--;
        if (activeListeners === 0) {
            setLoadingData(false);
        }
    };

    const unsubscribes = collectionsToFetch.map(({ name, setter, orderByField }) => {
        const ref = collection(db, `${companyPath}/${name}`);
        const q = query(ref, orderBy(orderByField, 'desc'));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const docData = doc.data();
                // Convert all timestamp fields
                Object.keys(docData).forEach(key => {
                    if (docData[key] instanceof Timestamp) {
                        docData[key] = docData[key].toDate();
                    }
                });
                return { id: doc.id, ...docData };
            });
            setter(data as any);
            onDone();
        }, (error) => {
            console.error(`Error fetching ${name}:`, error);
            toast({ variant: "destructive", title: `Erro ao buscar ${name}` });
            onDone();
        });
    });

    const closuresRef = collection(db, `${companyPath}/fiscalClosures`);
    const unsubClosures = onSnapshot(closuresRef, (snapshot) => {
        setClosedPeriods(snapshot.docs.map(doc => doc.id));
        onDone();
    });
    unsubscribes.push(unsubClosures);

    return () => {
        unsubscribes.forEach(unsub => unsub());
    };
}, [user, activeCompany, toast]);
  
  const monthlySummary = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    const currentMonthLaunches = launches.filter(item => {
        const itemDate = (item.date as any)?.toDate ? (item.date as any).toDate() : new Date(item.date);
        return isValid(itemDate) && isWithinInterval(itemDate, { start: monthStart, end: monthEnd });
    });

    const currentMonthRecibos = recibos.filter(item => {
        const itemDate = (item.data as any)?.toDate ? (item.data as any).toDate() : new Date(item.data);
        return isValid(itemDate) && isWithinInterval(itemDate, { start: monthStart, end: monthEnd });
    });

    const faturamento = currentMonthLaunches
        .filter(item => (item.type === 'saida' || item.type === 'servico') && item.status === 'Normal')
        .reduce((sum, item) => sum + (item.valorLiquido || item.valorTotalNota || 0), 0);
        
    const comprasNotas = currentMonthLaunches
        .filter(item => item.type === 'entrada' && item.status === 'Normal')
        .reduce((sum, item) => sum + (item.valorTotalNota || 0), 0);
        
    const comprasRecibos = currentMonthRecibos.reduce((sum, item) => sum + item.valor, 0);

    const notasEmitidas = currentMonthLaunches.length + currentMonthRecibos.length;

    return { faturamento, compras: comprasNotas + comprasRecibos, notasEmitidas };
}, [launches, recibos]);
  
  const monthlyChartData = useMemo(() => {
    const monthlyTotals: { [key: string]: { receitas: number, despesas: number } } = {};
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthlyTotals[key] = { receitas: 0, despesas: 0 };
    }
    
    launches.forEach(item => {
        const itemDate = (item.date as any)?.toDate ? (item.date as any).toDate() : new Date(item.date);
        if (!isValid(itemDate)) return;
        const key = `${itemDate.getFullYear()}-${itemDate.getMonth()}`;

        if (monthlyTotals[key]) {
            if (item.type === 'saida' || item.type === 'servico') {
                monthlyTotals[key].receitas += (item.valorLiquido || item.valorTotalNota || 0);
            } else if (item.type === 'entrada') {
                monthlyTotals[key].despesas += (item.valorTotalNota || 0);
            }
        }
    });

    recibos.forEach(item => {
        const itemDate = (item.data as any)?.toDate ? (item.data as any).toDate() : new Date(item.data);
        if (!isValid(itemDate)) return;
        const key = `${itemDate.getFullYear()}-${itemDate.getMonth()}`;
        if(monthlyTotals[key]) {
             if (item.natureza === 'receita') {
                monthlyTotals[key].receitas += item.valor;
            } else {
                monthlyTotals[key].despesas += item.valor;
            }
        }
    });
    
    return Object.keys(monthlyTotals).map(key => {
        const [year, month] = key.split('-').map(Number);
        return { month: monthNames[month], ...monthlyTotals[key] };
    });
  }, [launches, recibos]);

  const topClientsData = useMemo(() => {
    const clientRevenue: { [name: string]: number } = {};
    launches
        .filter(l => (l.type === 'saida' || l.type === 'servico') && l.status === 'Normal')
        .forEach(l => {
            const clientName = getPartnerName({ ...l, docType: 'launch' }, activeCompany);
            if (clientName && clientName !== 'N/A') {
                clientRevenue[clientName] = (clientRevenue[clientName] || 0) + (l.valorLiquido || l.valorTotalNota || 0);
            }
        });
    
    return Object.entries(clientRevenue)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5); // Top 5
}, [launches, activeCompany]);


  const refreshXmlFileStatus = useCallback(() => {
    if (launches.length === 0) {
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
        if (!file.key) return file;

        const existingLaunch = launchedItems.get(file.key);
        let newStatus: XmlFile['status'] = file.status;

        if (existingLaunch) {
            if (existingLaunch.status === 'Normal') {
                 newStatus = 'launched';
            }
        } else {
            if (file.status === 'launched') {
                 newStatus = 'pending';
            }
        }
        return { ...file, status: newStatus };
    }));
    toast({ title: 'Lista de XMLs atualizada!'})

  }, [launches, toast]);

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
        const querySelectorText = (element: Element | null, selectors: string[]): string => {
            if (!element) return '';
            for (const selector of selectors) {
                const el = element.querySelector(selector);
                if (el?.textContent) return el.textContent.trim();
            }
            return '';
        };

        const normalizedActiveCnpj = activeCompany.cnpj?.replace(/\D/g, '');

        let type: XmlFile['type'] = 'desconhecido';
        let status: XmlFile['status'] = 'pending';
        let key: string | undefined = undefined;
        let numero: string | undefined = undefined;
        let valor: number | undefined = undefined;

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
        const isNfsePadrao = xmlDoc.querySelector('CompNfse');
        const isNfseAbrasf = xmlDoc.querySelector('ConsultarNfseServicoPrestadoResposta');
        const isCancelled = xmlDoc.querySelector('procCancNFe, cancNFe');
        
        let nfseVersion = '';

        if (isCancelled) {
            type = 'cancelamento';
            status = 'cancelled';
        } else if (isNFe) {
            const ide = isNFe.querySelector('ide');
            const emit = isNFe.querySelector('emit');
            const dest = isNFe.querySelector('dest');
            const total = isNFe.querySelector('total > ICMSTot');

            numero = querySelectorText(ide, ['nNF']);
            valor = parseFloat(querySelectorText(total, ['vNF']) || '0');

            const emitCnpj = getCnpjCpfFromNode(emit, ['CNPJ', 'CPF']);
            const destCnpj = getCnpjCpfFromNode(dest, ['CNPJ', 'CPF']);
            
            key = (isNFe.getAttribute('Id') || '').replace('NFe', '');
            
            if (emitCnpj === normalizedActiveCnpj) type = 'saida';
            else if (destCnpj === normalizedActiveCnpj) type = 'entrada';

        } else if (isNfsePadrao || isNfseAbrasf) {
            const nfseNode = xmlDoc.querySelector('Nfse, NFSe');
            nfseVersion = nfseNode?.getAttribute('versao') || '1.00';
            
            const serviceNode = xmlDoc.querySelector('InfNfse') || xmlDoc.querySelector('InfDeclaracaoPrestacaoServico') || nfseNode;
            
            if (serviceNode) {
                 const prestadorCnpj = getCnpjCpfFromNode(serviceNode, ['PrestadorServico > CpfCnpj > Cnpj', 'Prestador > CpfCnpj > Cnpj', 'prest > CNPJ']);
                const tomadorCnpj = getCnpjCpfFromNode(serviceNode, ['TomadorServico > CpfCnpj > Cnpj', 'Tomador > CpfCnpj > Cpf', 'toma > CNPJ', 'toma > Cpf']);

                const numeroNfse = querySelectorText(serviceNode, ['Numero']);
                const codigoVerificacao = querySelectorText(serviceNode, ['CodigoVerificacao']);
                numero = numeroNfse;
                valor = parseFloat(querySelectorText(serviceNode.querySelector('Valores'), ['ValorLiquidoNfse']) || '0');

                key = `${numeroNfse}-${codigoVerificacao}-${nfseVersion}`;

                if (prestadorCnpj === normalizedActiveCnpj) type = 'servico';
                else if (tomadorCnpj === normalizedActiveCnpj) type = 'entrada';
            }
        }

        if(key) {
            const existingLaunch = launchedItems.get(key);
            if (existingLaunch) {
                 if (Math.abs(existingLaunch.valor - (valor || 0)) < 0.01 && existingLaunch.status !== 'Substituida') {
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
        return { file: fileData, content: fileContent, status, type, key, versaoNfse: nfseVersion, numero, valor };
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
  
  const handleLaunchSuccess = useCallback((launchedKey: string, status: Launch['status']) => {
     if (!launchedKey || !user || !activeCompany) return;

     setXmlFiles(files => files.map(f => {
         if (f.key === launchedKey) {
             return { ...f, status: status === 'Cancelado' ? 'cancelled' : 'launched' };
         }
         return f;
     }));
  }, [user, activeCompany]);

  const handleDeleteLaunch = async (launch: GenericLaunch) => {
    if (!user || !activeCompany || !launch.id) return;
    
    const collectionName = launch.docType === 'recibo' ? 'recibos' : 'launches';
    
    try {
        const launchRef = doc(db, `users/${user.uid}/companies/${activeCompany.id}/${collectionName}`, launch.id);
        await deleteDoc(launchRef);
        
        if (launch.docType === 'launch' && launch.chaveNfe) {
             setXmlFiles(files => 
                files.map(f => 
                    f.key === launch.chaveNfe ? { ...f, status: 'pending' } : f
                )
            );
        }

        toast({ title: "Lançamento excluído com sucesso!" });
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

  const isLaunchLocked = (launch: GenericLaunch): boolean => {
    const launchDateRaw = launch.docType === 'launch' ? launch.date : launch.data;
    const launchDate = (launchDateRaw as any)?.toDate ? (launchDateRaw as any).toDate() : new Date(launchDateRaw);
    if (!isValid(launchDate)) return false;
    const launchPeriod = format(launchDate, 'yyyy-MM');
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

  const handleCreateLaunchFromBudget = (orcamentoId: string) => {
    router.push(`/fiscal?orcamentoId=${orcamentoId}`);
    openLaunchModal({ orcamentoId, mode: 'create' });
  };

  const filteredItems = useMemo(() => {
    const genericLaunches: GenericLaunch[] = [
        ...launches.map(l => ({ ...l, docType: 'launch' as const })),
        ...recibos.map(r => ({ ...r, docType: 'recibo' as const })),
    ].sort((a, b) => {
        const dateA = a.docType === 'launch' ? a.date : a.data;
        const dateB = b.docType === 'launch' ? b.date : b.data;
        const d1 = (dateA as any)?.toDate ? (dateA as any).toDate() : new Date(dateA);
        const d2 = (dateB as any)?.toDate ? (dateB as any).toDate() : new Date(dateB);
        return d2.getTime() - d1.getTime();
    });


    return genericLaunches.filter(item => {
        let keyMatch = true;
        if(filterKey){
            if (item.docType === 'launch') {
                 keyMatch = item.chaveNfe?.includes(filterKey) || item.numeroNfse?.includes(filterKey) || false;
            } else {
                 keyMatch = String(item.numero || '').includes(filterKey) || item.referenteA.toLowerCase().includes(filterKey.toLowerCase());
            }
        }
        
        const typeMatch = filterType ? (item.docType === 'recibo' ? filterType === 'recibo' : item.type === filterType) : true;
        
        let dateMatch = true;
        const itemDateRaw = item.docType === 'launch' ? item.date : item.data;
        const itemDate = (itemDateRaw as any)?.toDate ? (itemDateRaw as any).toDate() : new Date(itemDateRaw);

        if (filterDate?.from) {
            const startDate = new Date(filterDate.from);
            startDate.setHours(0,0,0,0);
            dateMatch = itemDate >= startDate;
        }
        if (filterDate?.to && dateMatch) {
            const endDate = new Date(filterDate.to);
            endDate.setHours(23,59,59,999);
            dateMatch = itemDate <= endDate;
        }

        return keyMatch && typeMatch && dateMatch;
    });
  }, [launches, recibos, filterKey, filterType, filterDate]);

  const totalFilteredValue = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + getLaunchValue(item), 0);
  }, [filteredItems]);


  useEffect(() => {
    setLaunchesCurrentPage(1);
  }, [filterKey, filterType, filterDate]);


  const clearLaunchesFilters = () => {
    setFilterKey('');
    setFilterType('');
    setFilterDate(undefined);
  };


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
  
  const totalLaunchPages = Math.ceil(filteredItems.length / launchesItemsPerPage);
  const paginatedItems = filteredItems.slice(
    (launchesCurrentPage - 1) * launchesItemsPerPage,
    (launchesCurrentPage * launchesItemsPerPage)
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
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Button onClick={() => openLaunchModal({ manualLaunchType: 'saida', mode: 'create' })} className="w-full bg-blue-100 text-blue-800 hover:bg-blue-200"><FileText className="mr-2 h-4 w-4" /> Lançar Nota de Saída</Button>
          <Button onClick={() => openReceiptModal({ mode: 'create' })} className="w-full bg-indigo-100 text-indigo-800 hover:bg-indigo-200"><FileText className="mr-2 h-4 w-4" /> Lançamentos diversos</Button>
          <Button onClick={() => openLaunchModal({ manualLaunchType: 'entrada', mode: 'create' })} className="w-full bg-red-100 text-red-800 hover:bg-red-200"><FileText className="mr-2 h-4 w-4" /> Lançar Nota de Entrada</Button>
          <Button onClick={() => openLaunchModal({ manualLaunchType: 'servico', mode: 'create' })} className="w-full bg-yellow-100 text-yellow-800 hover:bg-yellow-200"><FileText className="mr-2 h-4 w-4" /> Lançar Nota de Serviço</Button>
          <Button className="w-full bg-orange-100 text-orange-800 hover:bg-orange-200" onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" /> Importar XML
          </Button>
           <Button asChild className="w-full bg-purple-100 text-purple-800 hover:bg-purple-200">
             <Link href="/fiscal/inventario">
                <ClipboardList className="mr-2 h-4 w-4" /> Processar Inventário
             </Link>
          </Button>
          <Button asChild className="w-full bg-teal-100 text-teal-800 hover:bg-teal-200">
             <Link href="/fiscal/calculo-inventario">
                <Calculator className="mr-2 h-4 w-4" /> Calcular Inventário
             </Link>
          </Button>
           <Button asChild className="w-full bg-cyan-100 text-cyan-800 hover:bg-cyan-200">
             <Link href="/fiscal/orcamento">
                <FileSignature className="mr-2 h-4 w-4" /> Gerar Orçamento
             </Link>
          </Button>
          <Button asChild className="w-full bg-sky-100 text-sky-800 hover:bg-sky-200">
             <Link href="/fiscal/apuracao">
                <Scale className="mr-2 h-4 w-4" /> Apuração de Impostos
             </Link>
          </Button>
          <Button onClick={() => setAnnualReportModalOpen(true)} className="w-full bg-gray-100 text-gray-800 hover:bg-gray-200">
            <BarChart3 className="mr-2 h-4 w-4" /> Relatório Anual
          </Button>
        </CardContent>
      </Card>


       <Card>
        <CardHeader>
          <CardTitle>Resumo do Mês</CardTitle>
          <CardDescription>Visão geral das atividades fiscais no mês corrente ({format(new Date(), 'MMMM/yyyy', { locale: ptBR })}).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
             <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Faturamento no Mês</CardTitle>
                    <Landmark className="h-4 w-4 text-green-600"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(monthlySummary.faturamento)}</div>
                    <p className="text-xs text-muted-foreground">Soma de NF-e de saída e NFS-e.</p>
                </CardContent>
            </Card>
             <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Compras no Mês</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-red-600"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-700 dark:text-red-400">{formatCurrency(monthlySummary.compras)}</div>
                    <p className="text-xs text-muted-foreground">Soma de NF-e de entrada e Recibos.</p>
                </CardContent>
            </Card>
             <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Notas Emitidas no Mês</CardTitle>
                    <FileText className="h-4 w-4 text-blue-600"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{monthlySummary.notasEmitidas}</div>
                     <p className="text-xs text-muted-foreground">Total de lançamentos no período.</p>
                </CardContent>
            </Card>
        </CardContent>
       </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary"/>Resultado Mensal</CardTitle>
                    <CardDescription>Receitas vs. Despesas nos últimos 6 meses.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlyChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value as number)} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                            <Bar dataKey="receitas" fill="#16a34a" name="Receitas" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="despesas" fill="#dc2626" name="Despesas" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/>Top 5 Clientes</CardTitle>
                    <CardDescription>Maiores faturamentos por cliente no período.</CardDescription>
                </CardHeader>
                <CardContent>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topClientsData} layout="vertical" margin={{ left: 10, right: 30 }}>
                             <CartesianGrid strokeDasharray="3 3" />
                             <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value as number)} />
                             <YAxis type="category" dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={80} tickFormatter={(value) => value.length > 12 ? `${value.substring(0,10)}...` : value} />
                             <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(value: number) => formatCurrency(value)} />
                             <Bar dataKey="total" fill="hsl(var(--primary))" name="Faturamento" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>


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
                                            <DropdownMenuItem onClick={() => handleCreateLaunchFromBudget(orc.id!)}><Send className="mr-2 h-4 w-4 text-green-600"/> Gerar Lançamento Fiscal</DropdownMenuItem>
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
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nº</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedXmlFiles.length > 0 ? paginatedXmlFiles.map((xmlFile, index) => (
                    <TableRow key={`${xmlFile.file.name}-${index}`}>
                        <TableCell className="font-medium max-w-[150px] truncate" title={xmlFile.file.name}>{xmlFile.file.name}</TableCell>
                        <TableCell>
                            <Badge variant={xmlFile.type === 'desconhecido' || xmlFile.type === 'cancelamento' ? 'destructive' : 'secondary'}>
                                {xmlFile.type.charAt(0).toUpperCase() + xmlFile.type.slice(1)}
                            </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{xmlFile.numero || 'N/A'}</TableCell>
                        <TableCell className="font-mono text-xs">{formatCurrency(xmlFile.valor || 0)}</TableCell>
                        <TableCell>
                            {getBadgeForXml(xmlFile)}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                            <Button size="sm" onClick={() => openLaunchModal({ xmlFile, mode: 'create' })} disabled={xmlFile.status !== 'pending'}>
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
                        <TableCell colSpan={6} className="h-24 text-center">
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
          <CardDescription>Visualize e filtre os lançamentos fiscais e recibos.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50 items-center">
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
                        <SelectItem value="recibo">Recibo</SelectItem>
                        <SelectItem value="comprovante">Comprovante</SelectItem>
                    </SelectContent>
                </Select>
                 <DateRangePicker date={filterDate} onDateChange={setFilterDate} />
                <Button variant="ghost" onClick={clearLaunchesFilters} className="sm:ml-auto">
                    <FilterX className="mr-2 h-4 w-4" />
                    Limpar Filtros
                </Button>
            </div>
            {loadingData ? (
                 <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
            ) : launches.length === 0 && recibos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-4 bg-muted rounded-full mb-4">
                    <FileStack className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold">Nenhum lançamento encontrado</h3>
                  <p className="text-muted-foreground mt-2">Use os botões acima para começar a lançar notas ou recibos.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Parceiro</TableHead>
                            <TableHead>Documento/Ref.</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedItems.length === 0 ? (
                             <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    Nenhum resultado encontrado para os filtros aplicados.
                                </TableCell>
                            </TableRow>
                        ) : paginatedItems.map(item => (
                            <TableRow key={item.id} className={cn(isLaunchLocked(item) && 'bg-muted/30 hover:bg-muted/50')}>
                                <TableCell>{format(item.docType === 'launch' ? (item.date as Date) : (item.data as Date), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>
                                    {getBadgeForLaunchType(item)}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                    {getPartnerName(item, activeCompany)}
                                </TableCell>
                                <TableCell className="font-mono text-xs max-w-[150px] truncate" title={getLaunchDocRef(item)}>
                                    {getLaunchDocRef(item)}
                                </TableCell>
                                <TableCell>
                                    {item.docType === 'launch' ? getBadgeForLaunchStatus(item.status) : <Badge variant="secondary">N/A</Badge>}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(getLaunchValue(item))}
                                </TableCell>
                                <TableCell className="text-right">
                                    {isLaunchLocked(item) ? (
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
                                            {item.docType === 'launch' && <DropdownMenuItem onClick={() => handleGeneratePdf(item)}><FileText className="mr-2 h-4 w-4" />Visualizar PDF</DropdownMenuItem>}
                                            <DropdownMenuItem onClick={() => item.docType === 'launch' ? openLaunchModal({ launch: item, mode: 'edit' }) : openReceiptModal({ receipt: item, mode: 'edit' })}>
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
                                                            Esta ação não pode ser desfeita. O lançamento será permanentemente removido.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteLaunch(item)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
        <CardFooter className="flex justify-between items-center">
            <div>
                 <p className="text-sm font-semibold">Valor Total Filtrado: <span className="text-primary">{formatCurrency(totalFilteredValue)}</span></p>
            </div>
            {totalLaunchPages > 1 && (
                <div className="flex justify-end items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setLaunchesCurrentPage(p => p - 1)} disabled={launchesCurrentPage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">Página {launchesCurrentPage} de {totalLaunchPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setLaunchesCurrentPage(p => p + 1)} disabled={launchesCurrentPage === totalLaunchPages}>
                        Próximo
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </CardFooter>
      </Card>
      
       {user && activeCompany && currentLaunchModalData &&
        <MemoizedLaunchFormModal 
            isOpen={isLaunchModalOpen}
            onClose={closeLaunchModal}
            initialData={currentLaunchModalData}
            userId={user.uid}
            company={activeCompany}
            onLaunchSuccess={handleLaunchSuccess}
            partners={partners}
            products={products}
            services={services}
        />
      }

      {user && activeCompany && currentReceiptModalData &&
        <MemoizedReceiptFormModal 
            isOpen={isReceiptModalOpen}
            onClose={closeReceiptModal}
            initialData={currentReceiptModalData}
            userId={user.uid}
            company={activeCompany}
            partners={partners}
            employees={employees}
        />
      }


      {user && activeCompany && (
        <FiscalClosingModal
            isOpen={isClosingModalOpen}
            onClose={() => setIsClosingModalOpen(false)}
            userId={user.uid}
            companyId={activeCompany.id}
        />
      )}

      {user && activeCompany && (
        <AnnualReportModal
            isOpen={isAnnualReportModalOpen}
            onClose={() => setAnnualReportModalOpen(false)}
            userId={user.uid}
            company={activeCompany}
        />
      )}
    </div>
  );
}
