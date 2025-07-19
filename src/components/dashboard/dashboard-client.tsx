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
  Package,
  Users,
} from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

const stats = [
  {
    title: "Total de Saídas",
    amount: "R$ 45.231,89",
    icon: ArrowUpRightSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    title: "Total de Entradas",
    amount: "R$ 12.871,20",
    icon: ArrowDownLeftSquare,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  {
    title: "Funcionários Ativos",
    amount: "12",
    icon: Users,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  {
    title: "Produtos Cadastrados",
    amount: "84",
    icon: Package,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
]

const chartData = [
  { month: "Jan", receitas: 4000, despesas: 2400 },
  { month: "Fev", receitas: 3000, despesas: 1398 },
  { month: "Mar", receitas: 5000, despesas: 9800 },
  { month: "Abr", receitas: 2780, despesas: 3908 },
  { month: "Mai", receitas: 1890, despesas: 4800 },
  { month: "Jun", receitas: 2390, despesas: 3800 },
]

const recentActivities = [
    { type: 'saida', description: "Nota de Saída #1024", value: "R$ 1.250,00", date: "2 dias atrás", icon: ArrowUpRightSquare, color: "text-blue-600", bgColor: "bg-blue-100" },
    { type: 'entrada', description: "Nota de Entrada #5541", value: "R$ 800,50", date: "3 dias atrás", icon: ArrowDownLeftSquare, color: "text-green-600", bgColor: "bg-green-100" },
    { type: 'contabil', description: "Lançamento Contábil: Salários", value: "R$ 15.400,00", date: "5 dias atrás", icon: BookOpen, color: "text-purple-600", bgColor: "bg-purple-100" },
    { type: 'servico', description: "Nota de Serviço #88", value: "R$ 2.500,00", date: "1 semana atrás", icon: DollarSign, color: "text-blue-600", bgColor: "bg-blue-100" },
]

export function DashboardClient() {
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
              <div className="text-2xl font-bold">{stat.amount}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Resultado Mensal</CardTitle>
            <CardDescription>Últimos 6 meses.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value/1000}k`} />
                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))'}} />
                <Bar dataKey="receitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Receitas" />
                <Bar dataKey="despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle>Atividades Recentes</CardTitle>
            <CardDescription>Últimos lançamentos realizados.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                    <div key={index} className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${activity.bgColor}`}>
                            <activity.icon className={`h-5 w-5 ${activity.color}`} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium leading-none">{activity.description}</p>
                            <p className="text-sm text-muted-foreground">{activity.date}</p>
                        </div>
                        <div className="font-medium text-sm">{activity.value}</div>
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
