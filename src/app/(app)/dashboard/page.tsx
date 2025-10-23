
"use client"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ArrowDownLeftSquare,
  ArrowUpRightSquare,
  BarChart2,
  BookOpen,
  CalendarCheck,
  DollarSign,
  FileStack,
  Loader2,
  Package,
  PieChart,
  Users,
  Plane,
  Bot,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
} from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Pie, Cell, LabelList } from "recharts"
import { useEffect, useState, useMemo, useCallback } from "react"
import { useAuth } from "@/lib/auth"
import { collection, query, onSnapshot, orderBy, limit, Timestamp, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { ptBR } from "date-fns/locale"
import { startOfDay, format, parse, isValid } from 'date-fns';
import type { CalendarEvent } from "@/types/event"
import { EventFormModal } from "@/components/utilitarios/event-form-modal"
import { Button } from "@/components/ui/button"
import type { Launch, Vacation, Payroll, RCI, Termination, Thirteenth, Company } from "@/types"
import { analyzeFinancials, type FinancialAnalystInput, type FinancialAnalystOutput } from "@/ai/flows/financial-analyst-flow"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { CalendarCard } from "@/components/dashboard/calendar-card"
import { Skeleton } from "@/components/ui/skeleton"


const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PIE_CHART_COLORS = ['#16a34a', '#dc2626']; // green-600, red-600

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  
  // Data States
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [personnelCosts, setPersonnelCosts] = useState<(Payroll | RCI | Vacation | Termination | Thirteenth)[]>([]);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  
  // UI States
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [financialAnalysis, setFinancialAnalysis] = useState<FinancialAnalystOutput | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const companyId = sessionStorage.getItem('activeCompanyId');
      const companyDataString = companyId ? sessionStorage.getItem(`company_${companyId}`) : null;
      if (companyDataString) {
          setActiveCompany(JSON.parse(companyDataString));
      }
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!user || !activeCompany?.id) {
      setLoadingData(false);
      setLoadingAnalysis(false);
      setLaunches([]); setPersonnelCosts([]); setEmployeesCount(0); setProductsCount(0); setEvents([]);
      return;
    }

    setLoadingData(true);
    try {
        const companyPath = `users/${user.uid}/companies/${activeCompany.id}`;
        
        const [
            launchesSnap,
            employeesSnap,
            productsSnap,
            eventsSnap,
            payrollsSnap,
            rcisSnap,
            vacationsSnap,
            terminationsSnap,
            thirteenthsSnap
        ] = await Promise.all([
            getDocs(query(collection(db, `${companyPath}/launches`), orderBy('date', 'desc'))),
            getDocs(query(collection(db, `${companyPath}/employees`), where('ativo', '==', true))),
            getDocs(collection(db, `${companyPath}/produtos`)),
            getDocs(query(collection(db, `${companyPath}/events`), orderBy('date', 'asc'))),
            getDocs(collection(db, `${companyPath}/payrolls`)),
            getDocs(collection(db, `${companyPath}/rcis`)),
            getDocs(collection(db, `${companyPath}/vacations`)),
            getDocs(collection(db, `${companyPath}/terminations`)),
            getDocs(collection(db, `${companyPath}/thirteenths`))
        ]);

        setLaunches(launchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate() } as Launch)));
        setEmployeesCount(employeesSnap.size);
        setProductsCount(productsSnap.size);
        setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate() } as CalendarEvent)));
        
        const allPersonnelCosts = [
            ...payrollsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payroll)),
            ...rcisSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RCI)),
            ...vacationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), startDate: (doc.data().startDate as Timestamp).toDate() } as Vacation)),
            ...terminationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), terminationDate: (doc.data().terminationDate as Timestamp).toDate() } as Termination)),
            ...thirteenthsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Thirteenth)),
        ];
        setPersonnelCosts(allPersonnelCosts);

    } catch (error) {
        console.error("Dashboard data fetch error:", error);
        toast({ variant: 'destructive', title: "Erro ao carregar dados do dashboard" });
    } finally {
        setLoadingData(false);
    }
  }, [user, activeCompany, toast]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const { totalEntradas, totalSaidas, chartData } = useMemo(() => {
    let totalEntradas = 0;
    let totalSaidas = 0;
    const monthlyTotals: { [key: string]: { entradas: number, saidas: number } } = {};
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthlyTotals[key] = { entradas: 0, saidas: 0 };
    }

    launches.forEach(l => {
        const value = l.valorLiquido || l.valorTotalNota || 0;
        const launchDate = l.date;
        const key = `${launchDate.getFullYear()}-${launchDate.getMonth()}`;

        if (l.type === 'saida' || l.type === 'servico') {
            totalEntradas += value;
            if (monthlyTotals[key]) monthlyTotals[key].entradas += value;
        } else if (l.type === 'entrada') {
            totalSaidas += value;
            if (monthlyTotals[key]) monthlyTotals[key].saidas += value;
        }
    });

    personnelCosts.forEach(item => {
        // Unify date extraction
        let itemDate;
        if ('period' in item && typeof item.period === 'string') {
            itemDate = parse(`01/${item.period}`, 'dd/MM/yyyy', new Date());
        } else if ('startDate' in item && (item as any).startDate) {
            itemDate = (item as any).startDate instanceof Timestamp ? (item as any).startDate.toDate() : new Date((item as any).startDate);
        } else if ('terminationDate' in item && (item as any).terminationDate) {
             itemDate = (item as any).terminationDate instanceof Timestamp ? (item as any).terminationDate.toDate() : new Date((item as any).terminationDate);
        } else if ('createdAt' in item && (item as any).createdAt) {
             itemDate = (item as any).createdAt instanceof Timestamp ? (item as any).createdAt.toDate() : new Date((item as any).createdAt);
        }

        if (!itemDate || !isValid(itemDate)) return;

        const key = `${itemDate.getFullYear()}-${itemDate.getMonth()}`;
        
        // Unify value extraction
        let value = 0;
        if ('totals' in item && item.totals) { // Payroll and RCI
            value = (item as any).totals?.totalProventos ?? 0;
        } else if ('result' in item && item.result) { // Vacation, Termination, Thirteenth
            value = (item as any).result?.totalProventos ?? 0;
        }
        
        if(value > 0) {
            totalSaidas += value;
            if (monthlyTotals[key]) {
                monthlyTotals[key].saidas += value;
            }
        }
      });
    
    const newChartData = Object.keys(monthlyTotals).map(key => {
        const [year, month] = key.split('-').map(Number);
        return { month: monthNames[month], ...monthlyTotals[key] };
    });

    return { totalEntradas, totalSaidas, chartData: newChartData };
  }, [launches, personnelCosts]);
  
  const getFinancialAnalysis = useCallback(async () => {
    if (!activeCompany || chartData.length === 0 || chartData.every(d => d.entradas === 0 && d.saidas === 0)) {
        setLoadingAnalysis(false);
        setFinancialAnalysis(null);
        return;
    }
    setLoadingAnalysis(true);
    try {
        const input: FinancialAnalystInput = {
            companyName: activeCompany.nomeFantasia,
            data: chartData,
        };
        const result = await analyzeFinancials(input);
        setFinancialAnalysis(result);
    } catch (error) {
        console.error("Error fetching financial analysis:", error);
        setFinancialAnalysis(null);
        // Do not toast here, it's annoying if it fails often. The UI will show a message.
    } finally {
        setLoadingAnalysis(false);
    }
  }, [activeCompany, chartData]);

  useEffect(() => {
    if (!loadingData && activeCompany) {
        getFinancialAnalysis();
    }
  }, [loadingData, activeCompany, getFinancialAnalysis]);


  const stats = [
    { title: "Total de Entradas (Receitas)", amount: formatCurrency(totalEntradas), icon: ArrowUpRightSquare, color: "text-green-600", bgColor: "bg-green-100" },
    { title: "Total de Saídas (Despesas)", amount: formatCurrency(totalSaidas), icon: ArrowDownLeftSquare, color: "text-red-600", bgColor: "bg-red-100" },
    { title: "Funcionários Ativos", amount: employeesCount.toString(), icon: Users, color: "text-yellow-600", bgColor: "bg-yellow-100" },
    { title: "Produtos Cadastrados", amount: productsCount.toString(), icon: Package, color: "text-blue-600", bgColor: "bg-blue-100" },
  ];

  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());

    const manualEvents: {id: string, type: 'event' | 'vacation', date: Date, title: string, description: string, icon: React.FC<any>}[] = events
      .filter(e => e.date >= today)
      .map(e => ({
        id: e.id!,
        type: 'event',
        date: e.date as Date,
        title: e.title,
        description: e.description || '',
        icon: CalendarCheck
      }));
      
    const vacationEvents = (personnelCosts.filter(p => 'startDate' in p) as Vacation[])
      .map(v => ({
        id: v.id!,
        type: 'vacation',
        date: v.startDate as Date,
        title: `Férias - ${v.employeeName}`,
        description: `${v.vacationDays} dias de férias`,
        icon: Plane,
      }));

    return [...manualEvents, ...vacationEvents]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);

  }, [events, personnelCosts]);


   const pieChartData = useMemo(() => {
    return [
      { name: 'Receitas', value: totalEntradas },
      { name: 'Despesas', value: totalSaidas },
    ];
  }, [totalEntradas, totalSaidas]);


  return (
    <>
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {loadingData ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{stat.amount}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
      
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bot className="h-6 w-6 text-primary" />
                    Análise Financeira com IA
                </CardTitle>
                 <CardDescription>Resumo inteligente da saúde financeira da sua empresa nos últimos meses.</CardDescription>
            </CardHeader>
            <CardContent>
                {loadingAnalysis ? (
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-3/4 rounded-md" />
                        <Skeleton className="h-4 w-full rounded-md" />
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-24 rounded-md" />
                                <Skeleton className="h-4 w-full rounded-md" />
                                <Skeleton className="h-4 w-5/6 rounded-md" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-24 rounded-md" />
                                <Skeleton className="h-4 w-full rounded-md" />
                                <Skeleton className="h-4 w-5/6 rounded-md" />
                            </div>
                        </div>
                    </div>
                ) : financialAnalysis ? (
                    <div>
                        <h3 className="font-semibold text-lg text-primary">{financialAnalysis.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 mb-4">{financialAnalysis.summary}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h4 className="font-semibold flex items-center gap-2 text-green-600"><TrendingUp className="h-5 w-5"/> Pontos Positivos</h4>
                                <ul className="list-none space-y-1 text-sm">
                                    {financialAnalysis.positivePoints.map((point, i) => (
                                        <li key={`pos-${i}`} className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                                            <span>{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                             <div className="space-y-2">
                                <h4 className="font-semibold flex items-center gap-2 text-amber-600"><TrendingDown className="h-5 w-5"/> Pontos de Atenção</h4>
                                <ul className="list-none space-y-1 text-sm">
                                    {financialAnalysis.improvementPoints.map((point, i) => (
                                        <li key={`imp-${i}`} className="flex items-start gap-2">
                                            <TrendingDown className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
                                            <span>{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Não há dados suficientes para gerar uma análise. Adicione lançamentos de entrada e saída para começar.</p>
                )}
            </CardContent>
        </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resultado Mensal</CardTitle>
                <CardDescription>Entradas vs. Saídas nos últimos 6 meses.</CardDescription>
                 <CardAction>
                    <Button variant="outline" size="icon" onClick={() => setChartType(prev => prev === 'bar' ? 'pie' : 'bar')}>
                        {chartType === 'bar' ? <PieChart className="h-4 w-4" /> : <BarChart2 className="h-4 w-4" />}
                    </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="pl-2">
                {loadingData ? <div className="flex justify-center items-center h-[350px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : 
                (chartType === 'bar' ? (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData}>
                            <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${formatCurrency(value/1000)}k`} />
                            <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))'}} formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                            <Bar dataKey="entradas" fill="#16a34a" radius={[4, 4, 0, 0]} name="Receitas">
                               <LabelList dataKey="entradas" position="insideTop" className="fill-black" fontSize={10} formatter={(value: number) => value > 0 ? formatCurrency(value) : ''} />
                            </Bar>
                            <Bar dataKey="saidas" fill="#dc2626" radius={[4, 4, 0, 0]} name="Despesas" >
                                <LabelList dataKey="saidas" position="insideTop" className="fill-black" fontSize={10} formatter={(value: number) => value > 0 ? formatCurrency(value) : ''} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                            <Pie
                                data={pieChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={120}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                ))}
              </CardContent>
            </Card>
        </div>
        <div className="col-span-4 lg:col-span-3 flex flex-col gap-6">
             <CalendarCard />
            <Card>
              <CardHeader>
                <CardTitle>Próximos Eventos</CardTitle>
                <CardDescription>Seus 5 próximos compromissos.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingData ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> :
                upcomingEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="p-4 bg-muted rounded-full mb-4">
                            <CalendarCheck className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">Nenhum evento futuro</h3>
                        <p className="text-muted-foreground mt-1 text-sm">Use o calendário para agendar.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {upcomingEvents.map(event => (
                            <div key={event.id} className="flex items-start gap-3 p-2 border-l-4 border-primary bg-primary/5 rounded">
                                 <div className="p-2 bg-primary/10 rounded-full">
                                    <event.icon className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold">{event.title} <span className="font-normal text-muted-foreground">({format(event.date, 'dd/MM/yyyy')})</span></p>
                                    <p className="text-sm text-muted-foreground">{event.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
    </>
  )
}

    