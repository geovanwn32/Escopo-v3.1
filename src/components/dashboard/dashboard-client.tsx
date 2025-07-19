
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
  DollarSign,
  FileStack,
  Loader2,
  Package,
  Users,
} from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"
import { collection, query, onSnapshot, orderBy, limit, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Badge } from "../ui/badge"

interface Launch {
  id: string;
  type: 'entrada' | 'saida' | 'servico';
  value: number;
  date: Date;
  fileName: string;
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
  const [loading, setLoading] = useState(true);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [stats, setStats] = useState<StatCard[]>([
    { title: "Total de Entradas", amount: formatCurrency(0), icon: ArrowDownLeftSquare, color: "text-green-600", bgColor: "bg-green-100" },
    { title: "Total de Saídas", amount: formatCurrency(0), icon: ArrowUpRightSquare, color: "text-red-600", bgColor: "bg-red-100" },
    { title: "Funcionários Ativos", amount: "0", icon: Users, color: "text-yellow-600", bgColor: "bg-yellow-100" },
    { title: "Produtos Cadastrados", amount: "0", icon: Package, color: "text-blue-600", bgColor: "bg-blue-100" },
  ]);
  const [chartData, setChartData] = useState<MonthlyData[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const companyId = sessionStorage.getItem('activeCompanyId');
      setActiveCompanyId(companyId);
    }
  }, []);

  useEffect(() => {
    if (!user || !activeCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const launchesRef = collection(db, `users/${user.uid}/companies/${activeCompanyId}/launches`);
    const q = query(launchesRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const launchesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, date: (data.date as Timestamp).toDate() } as Launch;
      });
      setLaunches(launchesData);

      // Calculate stats
      const totalEntradas = launchesData.filter(l => l.type === 'entrada' || l.type === 'servico').reduce((acc, l) => acc + l.value, 0);
      const totalSaidas = launchesData.filter(l => l.type === 'saida').reduce((acc, l) => acc + l.value, 0);

      setStats(prev => [
          { ...prev[0], amount: formatCurrency(totalEntradas) },
          { ...prev[1], amount: formatCurrency(totalSaidas) },
          ...prev.slice(2)
      ]);

      // Prepare chart data for the last 6 months
      const monthlyTotals: { [key: string]: { entradas: number, saidas: number } } = {};
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);

      for (let i = 0; i < 6; i++) {
        const date = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        monthlyTotals[key] = { entradas: 0, saidas: 0 };
      }
      
      launchesData.forEach(l => {
          const launchDate = l.date;
          if (launchDate >= sixMonthsAgo) {
            const key = `${launchDate.getFullYear()}-${launchDate.getMonth()}`;
            if (monthlyTotals[key]) {
              if (l.type === 'entrada' || l.type === 'servico') {
                monthlyTotals[key].entradas += l.value;
              } else if (l.type === 'saida') {
                monthlyTotals[key].saidas += l.value;
              }
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
      console.error("Error fetching dashboard data:", error);
      toast({ variant: 'destructive', title: "Erro ao carregar dados do dashboard" });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeCompanyId, toast]);

  return (
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
        <Card className="col-span-4">
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
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle>Atividades Recentes</CardTitle>
            <CardDescription>Últimos 5 lançamentos realizados.</CardDescription>
          </CardHeader>
          <CardContent>
             {loading ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> :
             launches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-4 bg-muted rounded-full mb-4">
                        <FileStack className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">Nenhuma atividade recente</h3>
                    <p className="text-muted-foreground mt-1 text-sm">Os últimos lançamentos aparecerão aqui.</p>
                </div>
             ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {launches.slice(0, 5).map(launch => (
                            <TableRow key={launch.id}>
                                <TableCell>{new Intl.DateTimeFormat('pt-BR').format(launch.date)}</TableCell>
                                <TableCell>
                                    <Badge variant={launch.type === 'saida' ? 'destructive' : 'secondary'}>
                                        {launch.type.charAt(0).toUpperCase() + launch.type.slice(1)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(launch.value)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
