
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
  Bot
} from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Pie, Cell, LabelList } from "recharts"
import { useEffect, useState, useMemo, useCallback } from "react"
import { useAuth } from "@/lib/auth"
import { collection, query, onSnapshot, orderBy, limit, Timestamp, where } from "firebase/firestore"
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


const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PIE_CHART_COLORS = ['#16a34a', '#dc2626']; // green-600, red-600

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [rcis, setRcis] = useState<RCI[]>([]);
  const [terminations, setTerminations] = useState<Termination[]>([]);
  const [thirteenths, setThirteenths] = useState<Thirteenth[]>([]);
  
  // UI States
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [financialAnalysis, setFinancialAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);


  const handleDayClick = (day: Date) => {
      setSelectedEventDate(day);
      setEventModalOpen(true);
  };

  const closeEventModal = () => {
    setEventModalOpen(false);
    setSelectedEventDate(null);
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const companyId = sessionStorage.getItem('activeCompanyId');
      const companyDataString = companyId ? sessionStorage.getItem(`company_${companyId}`) : null;
      if (companyDataString) {
          setActiveCompany(JSON.parse(companyDataString));
      }
    }
  }, []);

  useEffect(() => {
    if (!user || !activeCompany?.id) {
      setLoading(false);
      setLoadingAnalysis(false);
      setLaunches([]); setEmployeesCount(0); setProductsCount(0); setEvents([]); setVacations([]); setPayrolls([]); setRcis([]); setTerminations([]); setThirteenths([]);
      return;
    }

    setLoading(true);
    let listenersActive = 9;
    const onDone = () => {
        listenersActive--;
        if (listenersActive === 0) setLoading(false);
    }

    const unsubscribes = [
      onSnapshot(query(collection(db, `users/${user.uid}/companies/${activeCompany.id}/launches`), orderBy('date', 'desc')), (snapshot) => {
        setLaunches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate() } as Launch)));
        onDone();
      }, (error) => { console.error("Launches error:", error); toast({ variant: 'destructive', title: "Erro ao carregar lançamentos" }); onDone(); }),
      
      onSnapshot(query(collection(db, `users/${user.uid}/companies/${activeCompany.id}/employees`), where('ativo', '==', true)), (snapshot) => { setEmployeesCount(snapshot.size); onDone(); }, (error) => { console.error("Employees error:", error); onDone(); }),
      onSnapshot(collection(db, `users/${user.uid}/companies/${activeCompany.id}/produtos`), (snapshot) => { setProductsCount(snapshot.size); onDone(); }, (error) => { console.error("Products error:", error); onDone(); }),
      onSnapshot(query(collection(db, `users/${user.uid}/companies/${activeCompany.id}/events`), orderBy('date', 'asc')), (snapshot) => {
        setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate() } as CalendarEvent)));
        onDone();
      }, (error) => { console.error("Events error:", error); onDone(); }),
      
      onSnapshot(query(collection(db, `users/${user.uid}/companies/${activeCompany.id}/vacations`), where('startDate', '>=', startOfDay(new Date()))), (snapshot) => {
        setVacations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), startDate: (doc.data().startDate as Timestamp).toDate() } as Vacation)));
        onDone();
      }, (error) => { console.error("Vacations error:", error); onDone(); }),
      
      onSnapshot(collection(db, `users/${user.uid}/companies/${activeCompany.id}/payrolls`), (snapshot) => {
        setPayrolls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payroll)));
        onDone();
      }, (error) => { console.error("Payrolls error:", error); onDone(); }),

      onSnapshot(collection(db, `users/${user.uid}/companies/${activeCompany.id}/rcis`), (snapshot) => {
        setRcis(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RCI)));
        onDone();
      }, (error) => { console.error("RCIs error:", error); onDone(); }),

      onSnapshot(collection(db, `users/${user.uid}/companies/${activeCompany.id}/terminations`), (snapshot) => {
        setTerminations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), terminationDate: (doc.data().terminationDate as Timestamp).toDate() } as Termination)));
        onDone();
      }, (error) => { console.error("Terminations error:", error); onDone(); }),

      onSnapshot(collection(db, `users/${user.uid}/companies/${activeCompany.id}/thirteenths`), (snapshot) => {
        setThirteenths(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Thirteenth)));
        onDone();
      }, (error) => { console.error("Thirteenths error:", error); onDone(); }),
    ];

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user, activeCompany, toast]);

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

    const addPersonnelExpense = (items: (Payroll | RCI | Vacation | Termination | Thirteenth)[]) => {
      items.forEach(item => {
        const itemDate = (item as any).period 
            ? parse(`01/${(item as any).period}`, 'dd/MM/yyyy', new Date())
            : (item as any).startDate || (item as any).terminationDate;
        
        if (!itemDate || !isValid(itemDate)) return;

        const key = `${itemDate.getFullYear()}-${itemDate.getMonth()}`;
        const value = (item as any).totals?.liquido ?? (item as any).result?.liquido ?? 0;
        
        if(value > 0) {
            totalSaidas += value;
            if (monthlyTotals[key]) {
                monthlyTotals[key].saidas += value;
            }
        }
      });
    };

    addPersonnelExpense(payrolls);
    addPersonnelExpense(rcis);
    addPersonnelExpense(vacations);
    addPersonnelExpense(terminations);
    addPersonnelExpense(thirteenths);

    const newChartData = Object.keys(monthlyTotals).map(key => {
        const [year, month] = key.split('-').map(Number);
        return { month: monthNames[month], ...monthlyTotals[key] };
    });

    return { totalEntradas, totalSaidas, chartData: newChartData };
  }, [launches, payrolls, rcis, vacations, terminations, thirteenths]);
  
  const getFinancialAnalysis = useCallback(async () => {
    if (!activeCompany || chartData.length === 0 || chartData.every(d => d.entradas === 0 && d.saidas === 0)) {
        setLoadingAnalysis(false);
        return;
    }
    setLoadingAnalysis(true);
    try {
        const input: FinancialAnalystInput = {
            companyName: activeCompany.nomeFantasia,
            data: chartData,
        };
        const result = await analyzeFinancials(input);
        setFinancialAnalysis(result.analysis);
    } catch (error) {
        console.error("Error fetching financial analysis:", error);
        setFinancialAnalysis(null);
    } finally {
        setLoadingAnalysis(false);
    }
  }, [activeCompany, chartData]);

  useEffect(() => {
    if (!loading && activeCompany) {
        getFinancialAnalysis();
    }
  }, [loading, activeCompany, getFinancialAnalysis]);


  const stats = [
    { title: "Total de Entradas (Receitas)", amount: formatCurrency(totalEntradas), icon: ArrowUpRightSquare, color: "text-green-600", bgColor: "bg-green-100" },
    { title: "Total de Saídas (Despesas)", amount: formatCurrency(totalSaidas), icon: ArrowDownLeftSquare, color: "text-red-600", bgColor: "bg-red-100" },
    { title: "Funcionários Ativos", amount: employeesCount.toString(), icon: Users, color: "text-yellow-600", bgColor: "bg-yellow-100" },
    { title: "Produtos Cadastrados", amount: productsCount.toString(), icon: Package, color: "text-blue-600", bgColor: "bg-blue-100" },
  ];

  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());

    const manualEvents: CombinedEvent[] = events
      .filter(e => e.date >= today)
      .map(e => ({
        id: e.id!,
        type: 'event',
        date: e.date as Date,
        title: e.title,
        description: e.description || '',
        icon: CalendarCheck
      }));
      
    const vacationEvents: CombinedEvent[] = vacations
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

  }, [events, vacations]);


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
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{stat.amount}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
      
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bot className="h-6 w-6 text-primary" />
                    Análise Financeira com IA
                </CardTitle>
                 <CardDescription>Resumo inteligente da saúde financeira da sua empresa nos últimos meses.</CardDescription>
            </CardHeader>
            <CardContent>
                {loadingAnalysis ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Analisando dados financeiros...</span>
                    </div>
                ) : financialAnalysis ? (
                    <Alert>
                        <AlertTitle>Insight Rápido</AlertTitle>
                        <AlertDescription>
                            {financialAnalysis}
                        </AlertDescription>
                    </Alert>
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
                {loading ? <div className="flex justify-center items-center h-[350px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : 
                (chartType === 'bar' ? (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData}>
                            <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${formatCurrency(value/1000)}k`} />
                            <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))'}} formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                            <Bar dataKey="entradas" fill="#16a34a" radius={[4, 4, 0, 0]} name="Receitas" >
                                <LabelList dataKey="entradas" position="top" formatter={(value: number) => formatCurrency(value)} fontSize={10}/>
                            </Bar>
                            <Bar dataKey="saidas" fill="#dc2626" radius={[4, 4, 0, 0]} name="Despesas" >
                                <LabelList dataKey="saidas" position="top" formatter={(value: number) => formatCurrency(value)} fontSize={10}/>
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
                {loading ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> :
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
    {user && activeCompany?.id && (
        <EventFormModal
            isOpen={isEventModalOpen}
            onClose={closeEventModal}
            userId={user.uid}
            companyId={activeCompany.id}
            event={null}
            selectedDate={selectedEventDate}
        />
    )}
    </>
  )
}
