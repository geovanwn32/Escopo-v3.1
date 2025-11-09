
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
    ArrowDownLeft,
    ArrowUpRight,
    BarChart2,
    CalendarCheck,
    FileText,
    Loader2,
    Package,
    PieChart,
    Users,
    Plane,
    TrendingUp,
    ShoppingCart,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Pie, Cell } from "recharts"
import { useEffect, useState, useMemo, useCallback, Suspense } from "react"
import { useAuth } from "@/lib/auth"
import { collection, query, onSnapshot, orderBy, limit, Timestamp, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase.tsx"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { ptBR } from "date-fns/locale"
import { startOfDay, format, parse, isValid, isWithinInterval, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns';
import type { CalendarEvent } from "@/types/event"
import { EventFormModal } from "@/components/utilitarios/event-form-modal"
import { Button } from "@/components/ui/button"
import type { Launch, Vacation, Payroll, RCI, Termination, Thirteenth, Company, Recibo } from "@/types"
import { cn } from "@/lib/utils"


const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PIE_CHART_COLORS = ['#16a34a', '#dc2626']; // green-600, red-600
type DateRangeFilter = 'thisMonth' | 'last30Days' | 'thisYear';

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  
  // Data States
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [personnelCosts, setPersonnelCosts] = useState<(Payroll | RCI | Vacation | Termination | Thirteenth)[]>([]);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  
  // UI States
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventsCurrentPage, setEventsCurrentPage] = useState(1);
  const eventsItemsPerPage = 5;
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('thisMonth');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const companyId = sessionStorage.getItem('activeCompanyId');
      const companyDataString = companyId ? sessionStorage.getItem(`company_${companyId}`) : null;
      if (companyDataString) {
          setActiveCompany(JSON.parse(companyDataString));
      } else {
        setLoadingData(false);
      }
    }
  }, []);

  const fetchData = useCallback(async (userId: string, companyId: string) => {
    setLoadingData(true);
    try {
        const companyPath = `users/${userId}/companies/${companyId}`;
        
        const [
            launchesSnap,
            recibosSnap,
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
            getDocs(query(collection(db, `${companyPath}/recibos`), orderBy('data', 'desc'))),
            getDocs(query(collection(db, `${companyPath}/employees`), where('ativo', '==', true))),
            getDocs(collection(db, `${companyPath}/produtos`)),
            getDocs(query(collection(db, `${companyPath}/events`), orderBy('date', 'asc'))),
            getDocs(collection(db, `${companyPath}/payrolls`)),
            getDocs(collection(db, `${companyPath}/rcis`)),
            getDocs(collection(db, `${companyPath}/vacations`)),
            getDocs(collection(db, `${companyPath}/terminations`)),
            getDocs(collection(db, `${companyPath}/thirteenths`))
        ]);

        const parseTimestamp = (docData: any, field: string) => {
            const dateValue = docData[field];
            if (dateValue instanceof Timestamp) {
                return dateValue.toDate();
            }
            // Fallback for serialized dates (if any) or already-Date objects
            if (dateValue && typeof dateValue.toDate === 'function') {
                return dateValue.toDate();
            }
            if (dateValue instanceof Date) {
                return dateValue;
            }
            // Attempt to parse string dates, but this is less reliable
            return new Date(dateValue);
        };

        setLaunches(launchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), date: parseTimestamp(doc.data(), 'date') } as Launch)));
        setRecibos(recibosSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), data: parseTimestamp(doc.data(), 'data') } as Recibo)));
        setEmployeesCount(employeesSnap.size);
        setProductsCount(productsSnap.size);
        setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), date: parseTimestamp(doc.data(), 'date') } as CalendarEvent)));
        
        const allPersonnelCosts = [
            ...payrollsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payroll)),
            ...rcisSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RCI)),
            ...vacationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), startDate: parseTimestamp(doc.data(), 'startDate') } as Vacation)),
            ...terminationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), terminationDate: parseTimestamp(doc.data(), 'terminationDate') } as Termination)),
            ...thirteenthsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Thirteenth)),
        ];
        setPersonnelCosts(allPersonnelCosts);

    } catch (error) {
        console.error("Dashboard data fetch error:", error);
        toast({ variant: 'destructive', title: "Erro ao carregar dados do dashboard" });
    } finally {
        setLoadingData(false);
    }
  }, [toast]);


  useEffect(() => {
    if(user && activeCompany) {
        fetchData(user.uid, activeCompany.id);
    }
  }, [user, activeCompany, fetchData]);


  const { totalReceitas, totalDespesas, totalNotas, chartData } = useMemo(() => {
    const today = new Date();
    let filterStartDate, filterEndDate;
    
    switch (dateRangeFilter) {
      case 'last30Days':
        filterStartDate = subDays(today, 30);
        filterEndDate = today;
        break;
      case 'thisYear':
        filterStartDate = startOfYear(today);
        filterEndDate = endOfYear(today);
        break;
      case 'thisMonth':
      default:
        filterStartDate = startOfMonth(today);
        filterEndDate = endOfMonth(today);
        break;
    }

    let monthRevenue = 0;
    let monthExpenses = 0;
    let monthDocs = 0;
    
    // Monthly totals for cards, based on the selected filter
    const itemsInDateRange = [...launches, ...recibos].filter(item => {
        const itemDate = 'date' in item ? item.date : item.data;
        if (!isValid(itemDate)) return false;
        return isWithinInterval(itemDate, { start: filterStartDate, end: filterEndDate });
    });

    itemsInDateRange.forEach(item => {
        monthDocs++;
        if ('type' in item) { // It's a Launch
            const value = item.valorLiquido || item.valorTotalNota || 0;
            if (item.type === 'saida' || item.type === 'servico') {
                monthRevenue += value;
            } else if (item.type === 'entrada') {
                monthExpenses += value;
            }
        } else { // It's a Recibo
            monthExpenses += item.valor || 0;
        }
    });
    
    // Chart data for last 6 months (this remains constant regardless of filter for now)
    const monthlyTotals: { [key: string]: { receitas: number, despesas: number } } = {};
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthlyTotals[key] = { receitas: 0, despesas: 0 };
    }

    [...launches, ...recibos].forEach(item => {
        const itemDate = 'date' in item ? item.date : item.data;
        if (!isValid(itemDate)) return;
        const key = `${itemDate.getFullYear()}-${itemDate.getMonth()}`;

        if (monthlyTotals[key]) {
             if ('type' in item) { // Launch
                 const value = item.valorLiquido || item.valorTotalNota || 0;
                 if (item.type === 'saida' || item.type === 'servico') {
                     monthlyTotals[key].receitas += value;
                 } else if (item.type === 'entrada') {
                     monthlyTotals[key].despesas += value;
                 }
             } else { // Recibo
                 monthlyTotals[key].despesas += item.valor || 0;
             }
        }
    });

    personnelCosts.forEach(item => {
        let itemDate;
        // Determine the relevant date for the personnel cost item
        if ('period' in item && typeof item.period === 'string') {
            const [month, year] = item.period.split('/');
            itemDate = new Date(parseInt(year), parseInt(month) - 1, 15); // Use mid-month to be safe
        } else if ('startDate' in item && (item as any).startDate) { // Vacation
            itemDate = new Date((item as any).startDate);
        } else if ('terminationDate' in item && (item as any).terminationDate) { // Termination
             itemDate = new Date((item as any).terminationDate);
        } else if ('createdAt' in item && (item as any).createdAt) { // Thirteenth
             const ts = (item as any).createdAt;
             itemDate = ts.toDate ? ts.toDate() : new Date(ts);
        }

        if (!itemDate || !isValid(itemDate)) return;

        const key = `${itemDate.getFullYear()}-${itemDate.getMonth()}`;
        
        let value = 0;
        if ('totals' in item && item.totals) { // Payroll, RCI
            value = (item as any).totals?.totalProventos ?? 0;
        } else if ('result' in item && item.result) { // Vacation, Termination, Thirteenth
            value = (item as any).result?.totalProventos ?? 0;
        }
        
        if(value > 0 && monthlyTotals[key]) {
            monthlyTotals[key].despesas += value;
        }
    });
    
    const newChartData = Object.keys(monthlyTotals).map(key => {
        const [year, month] = key.split('-').map(Number);
        return { month: monthNames[month], ...monthlyTotals[key] };
    });

    return { totalReceitas: monthRevenue, totalDespesas: monthExpenses, totalNotas: monthDocs, chartData: newChartData };
  }, [launches, recibos, personnelCosts, dateRangeFilter]);
  
  const stats = [
    { title: "Faturamento no Período", amount: formatCurrency(totalReceitas), icon: TrendingUp, color: "text-green-600", bgColor: "bg-green-100" },
    { title: "Compras e Despesas", amount: formatCurrency(totalDespesas), icon: ShoppingCart, color: "text-red-600", bgColor: "bg-red-100" },
    { title: "Notas e Recibos", amount: totalNotas.toString(), icon: FileText, color: "text-blue-600", bgColor: "bg-blue-100" },
    { title: "Resultado", amount: formatCurrency(totalReceitas - totalDespesas), icon: BarChart2, color: "text-indigo-600", bgColor: "bg-indigo-100" },
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

  }, [events, personnelCosts]);
  
  const totalEventPages = Math.ceil(upcomingEvents.length / eventsItemsPerPage);
  const paginatedEvents = upcomingEvents.slice(
    (eventsCurrentPage - 1) * eventsItemsPerPage,
    eventsCurrentPage * eventsItemsPerPage
  );

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsEventModalOpen(true);
  };
  
  return (
    <>
    <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
                <Button variant={dateRangeFilter === 'thisMonth' ? 'default' : 'ghost'} size="sm" onClick={() => setDateRangeFilter('thisMonth')}>Este Mês</Button>
                <Button variant={dateRangeFilter === 'last30Days' ? 'default' : 'ghost'} size="sm" onClick={() => setDateRangeFilter('last30Days')}>Últimos 30 dias</Button>
                <Button variant={dateRangeFilter === 'thisYear' ? 'default' : 'ghost'} size="sm" onClick={() => setDateRangeFilter('thisYear')}>Este Ano</Button>
            </div>
        </div>
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
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
            <CardHeader>
            <CardTitle>Resultado dos últimos 6 meses.</CardTitle>
            <CardDescription>Receitas vs. Despesas</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="flex justify-center items-center h-[350px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={chartData}>
                         <defs>
                            <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${formatCurrency(value/1000)}k`} />
                        <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))'}} formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#16a34a" fillOpacity={1} fill="url(#colorReceitas)" />
                        <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#dc2626" fillOpacity={1} fill="url(#colorDespesas)" />
                    </AreaChart>
                </ResponsiveContainer>
             </Suspense>
            </CardContent>
        </Card>
        <div className="col-span-4 lg:col-span-3 flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Calendário</CardTitle>
                    <CardDescription>Clique em um dia para adicionar um novo evento.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Calendar
                        mode="single"
                        onDayClick={handleDayClick}
                        className="p-0 [&_td]:w-full"
                        locale={ptBR}
                        modifiers={{
                            events: events.map(e => e.date as Date)
                        }}
                        modifiersClassNames={{
                            events: "relative before:content-[''] before:absolute before:bottom-1 before:left-1/2 before:-translate-x-1/2 before:w-1 before:h-1 before:rounded-full before:bg-primary"
                        }}
                    />
                </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Próximos Eventos</CardTitle>
                <CardDescription>Seus próximos compromissos.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingData ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> :
                paginatedEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="p-4 bg-muted rounded-full mb-4">
                            <CalendarCheck className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">Nenhum evento futuro</h3>
                        <p className="text-muted-foreground mt-1 text-sm">Use o calendário para agendar.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {paginatedEvents.map(event => (
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
               {totalEventPages > 1 && (
                <CardFooter className="flex justify-end items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEventsCurrentPage(p => p - 1)} disabled={eventsCurrentPage === 1}>
                        <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">Página {eventsCurrentPage} de {totalEventPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setEventsCurrentPage(p => p + 1)} disabled={eventsCurrentPage === totalEventPages}>
                        Próximo <ChevronRight className="h-4 w-4" />
                    </Button>
                </CardFooter>
            )}
            </Card>
        </div>
      </div>
    </div>

    {user && activeCompany && (
        <EventFormModal
            isOpen={isEventModalOpen}
            onClose={() => setIsEventModalOpen(false)}
            userId={user.uid}
            companyId={activeCompany.id}
            event={null} // For now, only creating new events from dashboard
            selectedDate={selectedDate}
        />
    )}
    </>
  )
}

    
