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
  Package,
  Users,
} from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

const stats = [
  {
    title: "Total de Saídas",
    amount: "R$ 0,00",
    icon: ArrowUpRightSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    title: "Total de Entradas",
    amount: "R$ 0,00",
    icon: ArrowDownLeftSquare,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  {
    title: "Funcionários Ativos",
    amount: "0",
    icon: Users,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  {
    title: "Produtos Cadastrados",
    amount: "0",
    icon: Package,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
]

const chartData = [
  { month: "Jan", receitas: 0, despesas: 0 },
  { month: "Fev", receitas: 0, despesas: 0 },
  { month: "Mar", receitas: 0, despesas: 0 },
  { month: "Abr", receitas: 0, despesas: 0 },
  { month: "Mai", receitas: 0, despesas: 0 },
  { month: "Jun", receitas: 0, despesas: 0 },
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
             <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <FileStack className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Nenhuma atividade recente</h3>
                <p className="text-muted-foreground mt-1 text-sm">Os últimos lançamentos aparecerão aqui.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
