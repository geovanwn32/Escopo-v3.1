
"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ArrowDownLeftSquare,
  ArrowUpRightSquare,
  BookOpen,
  CalendarCheck,
  DollarSign,
  FileStack,
  Loader2,
  Package,
  Users,
} from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"
import { collection, query, onSnapshot, orderBy, limit, Timestamp, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Badge } from "../ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { ptBR } from "date-fns/locale"
import { startOfDay } from 'date-fns';
import type { CalendarEvent } from "@/types/event"
import { EventFormModal } from "../utilitarios/event-form-modal"

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

export function DashboardClient() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyCnpj, setActiveCompanyCnpj] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [stats, setStats] = useState<StatCard[]>([
    { title: "Total de Entradas", amount: formatCurrency(0), icon: ArrowDownLeftSquare, color: "text-green-600", bgColor: "bg-green-100" },
    { title: "Total de Saídas", amount: formatCurrency(0), icon: ArrowUpRightSquare, color: "text-red-600", bgColor: "bg-red-100" },
    { title: "Funcionários Ativos", amount: "0", icon: Users, color: "text-yellow-600", bgColor: "bg-yellow-100" },
    { title: "Produtos Cadastrados", amount: "0", icon: Package, color: "text-blue-600", bgColor: "bg-blue-100" },
  ]);
  const [chartData, setChartData] = useState<MonthlyData[]>([]);

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
    if (!user || !activeCompanyId) return;

    const eventsRef = collection(db, `users/${user.uid}/companies/${activeCompanyId}/events`);
    const q = query(eventsRef, orderBy('date', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: (doc.data().date as Timestamp).toDate(),
      } as CalendarEvent));
      setEvents(eventsData);
    });

    return () => unsubscribe();
  }, [user, activeCompanyId]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const companyId = sessionStorage.getItem('activeCompanyId');
      setActiveCompanyId(companyId);
      if (companyId) {
        const companyDataString = sessionStorage.getItem(`company_${companyId}`);
        if (companyDataString) {
            const companyData = JSON.parse(companyDataString);
            setActiveCompanyCnpj(companyData.cnpj?.replace(/\D/g, ''));
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!user || !activeCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompanyId}/launches`);
    const launchesQuery = query(launchesRef, orderBy('date', 'desc'));

    const employeesRef = collection(db, `users/${user.uid}/companies/${activeCompanyId}/employees`);
    const employeesQuery = query(employeesRef, where('ativo', '==', true));

    const unsubscribeLaunches = onSnapshot(launchesQuery, (snapshot) => {
      const launchesData: Launch[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data, 
            date: (data.date as Timestamp).toDate() 
        } as Launch;
      });
      setLaunches(launchesData);

      let totalEntradas = 0;
      let totalSaidas = 0;
      
      launchesData.forEach(l => {
        const value = l.valorLiquido || l.valorTotalNota || 0;
        const emitenteCnpj = l.emitente?.cnpj?.replace(/\D/g, '');
        const destinatarioCnpj = l.destinatario?.cnpj?.replace(/\D/g, '');
        const prestadorCnpj = l.prestador?.cnpj?.replace(/\D/g, '');
        const tomadorCnpj = l.tomador?.cnpj?.replace(/\D/g, '');

        if (l.type === 'entrada' && destinatarioCnpj === activeCompanyCnpj) {
          totalEntradas += value;
        }

        if (l.type === 'saida' && emitenteCnpj === activeCompanyCnpj) {
          totalSaidas += value;
        } else if (l.type === 'servico' && prestadorCnpj === activeCompanyCnpj) {
          totalSaidas += value;
        }
      });

      setStats(prev => [
          { ...prev[0], amount: formatCurrency(totalEntradas) },
          { ...prev[1], amount: formatCurrency(totalSaidas) },
          { ...prev[2], amount: employeesCount.toString() },
          ...prev.slice(3)
      ]);

      const monthlyTotals: { [key: string]: { entradas: number, saidas: number } } = {};
      const today = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthlyTotals[key] = { entradas: 0, saidas: 0 };
      }
      
      launchesData.forEach(l => {
          const launchDate = l.date;
          const key = `${launchDate.getFullYear()}-${launchDate.getMonth()}`;
          
          if (monthlyTotals[key]) {
            const value = l.valorLiquido || l.valorTotalNota || 0;
            const emitenteCnpj = l.emitente?.cnpj?.replace(/\D/g, '');
            const destinatarioCnpj = l.destinatario?.cnpj?.replace(/\D/g, '');
            const prestadorCnpj = l.prestador?.cnpj?.replace(/\D/g, '');
            const tomadorCnpj = l.tomador?.cnpj?.replace(/\D/g, '');

            if (l.type === 'entrada' && destinatarioCnpj === activeCompanyCnpj) {
              monthlyTotals[key].entradas += value;
            }
            
            if (l.type === 'saida' && emitenteCnpj === activeCompanyCnpj) {
              monthlyTotals[key].saidas += value;
            } else if (l.type === 'servico' && prestadorCnpj === activeCompanyCnpj) {
              monthlyTotals[key].saidas += value;
            }
          }
      });
      
      const newChartData = Object.keys(monthlyTotals).map(key => {
          const [year, month] = key.split('-').map(Number);
          return {
              month: monthNames[month],
              ...monthlyTotals[key]
          };
      });

      setChartData(newChartData);

      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar lançamentos:", error);
      toast({ variant: 'destructive', title: "Erro ao carregar lançamentos" });
      setLoading(false);
    });

    const unsubscribeEmployees = onSnapshot(employeesQuery, (snapshot) => {
        setEmployeesCount(snapshot.size);
        setStats(prev => [
          ...prev.slice(0, 2),
          { ...prev[2], amount: snapshot.size.toString() },
          ...prev.slice(3)
      ]);
    }, (error) => {
        console.error("Erro ao buscar funcionários:", error);
        toast({ variant: 'destructive', title: "Erro ao carregar contagem de funcionários" });
    });


    return () => {
        unsubscribeLaunches();
        unsubscribeEmployees();
    };
  }, [user, activeCompanyId, activeCompanyCnpj, toast, employeesCount]);

  const upcomingEvents = events.filter(e => e.date >= startOfDay(new Date())).slice(0, 5);

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
              </CardHeader>
              <CardContent className="pl-2">
                {loading ? <div className="flex justify-center items-center h-[350px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : 
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${formatCurrency(value/1000)}k`} />
                    <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))'}} formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Entradas" />
                    <Bar dataKey="saidas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Saídas" />
                  </BarChart>
                </ResponsiveContainer>}
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
                    modifiers={{ scheduled: events.map(e => e.date as Date) }}
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
                                <div className="text-center font-semibold">
                                    <p className="text-sm">{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(event.date as Date).toUpperCase()}</p>
                                    <p className="text-xl">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(event.date as Date)}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">{event.title}</p>
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
