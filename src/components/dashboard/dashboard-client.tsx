
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
} from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Pie, Cell } from "recharts"
import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/lib/auth"
import { collection, query, onSnapshot, orderBy, limit, Timestamp, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Badge } from "../ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { ptBR } from "date-fns/locale"
import { startOfDay, format } from 'date-fns';
import type { CalendarEvent } from "@/types/event"
import { EventFormModal } from "../utilitarios/event-form-modal"
import { Button } from "../ui/button"
import type { Vacation } from "@/types/vacation"

interface Launch {
  id: string;
  type: 'entrada' | 'saida' | 'servico';
  date: Date;
  fileName: string;
  valorLiquido?: number;
  valorTotalNota?: number;
  prestador?: { cnpj?: string | null };
  tomador?: { cnpj?: string | null };
  emitente?: { cnpj?: string | null };
  destinatario?: { cnpj?: string | null };
}

interface CombinedEvent {
    id: string;
    type: 'event' | 'vacation';
    date: Date;
    title: string;
    description: string;
    icon: React.ElementType;
}


interface StatCard {
  title: string;
  amount: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface MonthlyData {
    month: string;
    entradas: number;
    saidas: number;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PIE_CHART_COLORS = ['#dc2626', '#16a34a']; // red-600, green-600

export function DashboardClient() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [vacations, setVacations] = useState<Vacation[]>([]);


  // Calendar State
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [month, setMonth] = useState<Date | undefined>(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
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
      setActiveCompanyId(companyId);
    }
  }, []);

  useEffect(() => {
    if (!user || !activeCompanyId) {
      setLoading(false);
      setLaunches([]);
      setEmployeesCount(0);
      setProductsCount(0);
      setEvents([]);
      setVacations([]);
      return;
    }

    setLoading(true);

    const launchesQuery = query(collection(db, `users/${user.uid}/companies/${activeCompanyId}/launches`), orderBy('date', 'desc'));
    const employeesQuery = query(collection(db, `users/${user.uid}/companies/${activeCompanyId}/employees`), where('ativo', '==', true));
    const productsQuery = query(collection(db, `users/${user.uid}/companies/${activeCompanyId}/produtos`));
    const eventsQuery = query(collection(db, `users/${user.uid}/companies/${activeCompanyId}/events`), orderBy('date', 'asc'));
    const vacationsQuery = query(collection(db, `users/${user.uid}/companies/${activeCompanyId}/vacations`), where('startDate', '>=', startOfDay(new Date())));

    const unsubscribes = [
      onSnapshot(launchesQuery, (snapshot) => {
        const launchesData: Launch[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate() } as Launch));
        setLaunches(launchesData);
      }, (error) => { console.error("Launches error:", error); toast({ variant: 'destructive', title: "Erro ao carregar lançamentos" }); }),
      
      onSnapshot(employeesQuery, (snapshot) => setEmployeesCount(snapshot.size), (error) => { console.error("Employees error:", error); toast({ variant: 'destructive', title: "Erro ao carregar funcionários" }); }),
      
      onSnapshot(productsQuery, (snapshot) => setProductsCount(snapshot.size), (error) => { console.error("Products error:", error); toast({ variant: 'destructive', title: "Erro ao carregar produtos" }); }),
      
      onSnapshot(eventsQuery, (snapshot) => {
        const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate() } as CalendarEvent));
        setEvents(eventsData);
      }, (error) => { console.error("Events error:", error); toast({ variant: 'destructive', title: "Erro ao carregar eventos" }); }),
      
      onSnapshot(vacationsQuery, (snapshot) => {
        const vacationsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), startDate: (doc.data().startDate as Timestamp).toDate() } as Vacation));
        setVacations(vacationsData);
      }, (error) => { console.error("Vacations error:", error); toast({ variant: 'destructive', title: "Erro ao carregar férias" }); })
    ];

    Promise.all(unsubscribes.map(unsub => new Promise(res => setTimeout(res, 0)))).finally(() => setLoading(false));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user, activeCompanyId, toast]);

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
        if (l.type === 'entrada') {
            totalEntradas += value;
        } else if (l.type === 'saida' || l.type === 'servico') {
            totalSaidas += value;
        }
        
        const launchDate = l.date;
        const key = `${launchDate.getFullYear()}-${launchDate.getMonth()}`;
        if (monthlyTotals[key]) {
            if (l.type === 'entrada') {
                monthlyTotals[key].entradas += value;
            } else if (l.type === 'saida' || l.type === 'servico') {
                monthlyTotals[key].saidas += value;
            }
        }
    });

    const newChartData = Object.keys(monthlyTotals).map(key => {
        const [year, month] = key.split('-').map(Number);
        return { month: monthNames[month], ...monthlyTotals[key] };
    });

    return { totalEntradas, totalSaidas, chartData: newChartData };
  }, [launches]);

  const stats: StatCard[] = [
    { title: "Total de Entradas (Despesas)", amount: formatCurrency(totalEntradas), icon: ArrowDownLeftSquare, color: "text-red-600", bgColor: "bg-red-100" },
    { title: "Total de Saídas (Receitas)", amount: formatCurrency(totalSaidas), icon: ArrowUpRightSquare, color: "text-green-600", bgColor: "bg-green-100" },
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
      { name: 'Entradas (Despesas)', value: totalEntradas },
      { name: 'Saídas (Receitas)', value: totalSaidas },
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
                            <Bar dataKey="saidas" fill="#16a34a" radius={[4, 4, 0, 0]} name="Saídas (Receitas)" />
                            <Bar dataKey="entradas" fill="#dc2626" radius={[4, 4, 0, 0]} name="Entradas (Despesas)" />
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
             <Card>
                <CardHeader>
                    <CardTitle>Calendário de Eventos</CardTitle>
                    <CardDescription>Clique em um dia para adicionar um evento.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Calendar
                    mode="single"
                    month={month}
                    onMonthChange={setMonth}
                    selected={date}
                    onSelect={setDate}
                    onDayClick={handleDayClick}
                    className="p-0"
                    locale={ptBR}
                    modifiers={{ scheduled: upcomingEvents.map(e => e.date as Date) }}
                    modifiersClassNames={{ scheduled: 'bg-primary/20 rounded-full' }}
                    />
                </CardContent>
            </Card>
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
    {user && activeCompanyId && (
        <EventFormModal
            isOpen={isEventModalOpen}
            onClose={closeEventModal}
            userId={user.uid}
            companyId={activeCompanyId}
            event={null}
            selectedDate={selectedEventDate}
        />
    )}
    </>
  )
}
