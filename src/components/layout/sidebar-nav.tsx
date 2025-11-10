
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  useSidebar
} from "@/components/ui/sidebar"
import {
  BookCheck,
  LayoutDashboard,
  FileStack,
  Users,
  Building2,
  Handshake,
  UserCog,
  Package,
  Wrench,
  Percent,
  BarChart3,
  Settings,
  BookUser,
  FileText,
  Briefcase,
  Share2,
  Calculator,
  Link as LinkIcon,
  Archive,
  Calendar,
  LifeBuoy,
  Shield,
  BookCopy,
  Landmark,
  FileDigit,
  Scale,
  Upload,
  ClipboardList,
  FileSignature,
  ArrowUpRightSquare,
  ArrowDownLeftSquare,
  LineChart,
  Gift,
  SendToBack,
  UserMinus,
} from "lucide-react"

export const fiscalLinks = [
    { href: "/fiscal/orcamento", icon: <FileSignature />, label: "Orçamentos" },
    { href: "/fiscal", icon: <FileStack />, label: "Lançamentos Fiscais" },
    { href: "/fiscal/apuracao", icon: <Scale />, label: "Apuração de Impostos" },
    { href: "/fiscal/inventario", icon: <ClipboardList />, label: "Processar Inventário" },
    { href: "/fiscal/calculo-inventario", icon: <Calculator />, label: "Calcular Inventário" },
];

export const pessoalLinks = [
    { href: "/pessoal/folha-de-pagamento", icon: <ClipboardList />, label: "Folha de Pagamento" },
    { href: "/pessoal/rci", icon: <FileText />, label: "RCI (Pró-labore)" },
    { href: "/pessoal/decimo-terceiro", icon: <Gift />, label: "13º Salário" },
    { href: "/pessoal/ferias", icon: <SendToBack />, label: "Férias" },
    { href: "/pessoal/rescisao", icon: <UserMinus />, label: "Rescisão" },
    { href: "/pessoal/resumo-folha", icon: <BookUser />, label: "Resumo da Folha" },
];

export const contabilLinks = [
    { href: "/contabil/plano-de-contas", icon: <BookCopy />, label: "Plano de Contas" },
    { href: "/contabil/lancamentos", icon: <FileText />, label: "Lançamentos" },
    { href: "/contabil/importacao-extrato", icon: <Upload />, label: "Importar Extrato (IA)" },
    { href: "/contabil/conciliacao", icon: <Scale />, label: "Conciliação" },
    { href: "/contabil/relatorios-contabeis", icon: <BarChart3 />, label: "Relatórios Contábeis" },
];

export const financeiroLinks = [
    { href: "/financeiro/contas-a-receber", icon: <ArrowUpRightSquare />, label: "Contas a Receber" },
    { href: "/financeiro/contas-a-pagar", icon: <ArrowDownLeftSquare />, label: "Contas a Pagar" },
    { href: "/financeiro/fluxo-de-caixa", icon: <LineChart />, label: "Fluxo de Caixa" },
    { href: "/financeiro/conciliacao", icon: <Scale />, label: "Conciliação Bancária" },
];

export const cadastroLinks = [
    { href: "/parceiros", icon: <Handshake />, label: "Parceiros" },
    { href: "/funcionarios", icon: <UserCog />, label: "Funcionários" },
    { href: "/socios", icon: <Briefcase />, label: "Sócios" },
    { href: "/produtos", icon: <Package />, label: "Produtos" },
    { href: "/servicos", icon: <Wrench />, label: "Serviços" },
    { href: "/aliquotas", icon: <Percent />, label: "Alíquotas" },
    { href: "/rubricas", icon: <FileText />, label: "Rubricas" },
    { href: "/fichas", icon: <BookUser />, label: "Fichas" },
];

export const conectividadeLinks = [
    { href: "/esocial", icon: <Share2 />, label: "eSocial" },
    { href: "/pgdas", icon: <Calculator />, label: "PGDAS" },
    { href: "/efd-contribuicoes", icon: <FileDigit />, label: "EFD Contribuições" },
    { href: "/reinf", icon: <FileText />, label: "EFD-Reinf" },
]

export const relatoriosLinks = [
    { href: "/relatorios/receita-bruta", icon: <FileText />, label: "Receita Bruta" },
    { href: "/relatorios/vendas", icon: <LineChart />, label: "Vendas" },
    { href: "/relatorios/compras", icon: <ArrowDownLeftSquare />, label: "Compras" },
    { href: "/relatorios/recibos", icon: <FileText />, label: "Recibos" },
    { href: "/relatorios/comprovantes", icon: <FileText />, label: "Comprovantes" },
    { href: "/relatorios/funcionarios", icon: <Users />, label: "Funcionários" },
    { href: "/relatorios/produtos", icon: <Package />, label: "Produtos" },
]

export const utilitariosLinks = [
    { href: "/utilitarios/eventos", icon: <Calendar />, label: "Agenda" },
    { href: "/utilitarios/links", icon: <LinkIcon />, label: "Links Úteis" },
    { href: "/utilitarios/arquivos", icon: <Archive />, label: "Arquivos" },
];

export const sistemaLinks = [
    { href: "/minha-empresa", icon: <Building2 />, label: "Minha Empresa" },
    { href: "/configuracoes", icon: <Settings />, label: "Configurações" },
    { href: "/admin", icon: <Shield />, label: "Admin", adminOnly: true },
];

export const mainNavLinks = [
  { href: "/dashboard", icon: <LayoutDashboard />, label: "Dashboard" },
  { href: "/fiscal", icon: <FileStack />, label: "Fiscal" },
  { href: "/pessoal", icon: <Users />, label: "Pessoal" },
  { href: "/contabil", icon: <BookCopy />, label: "Contábil" },
  { href: "/financeiro", icon: <Landmark />, label: "Financeiro" },
  { href: "/parceiros", icon: <Handshake />, label: "Cadastros" },
  { href: "/conectividade", icon: <Share2 />, label: "Conectividade"},
  { href: "/relatorios", icon: <BarChart3 />, label: "Relatórios" },
];

const getLinksForPath = (pathname: string) => {
    if (pathname.startsWith('/dashboard')) return { title: 'Navegação', links: mainNavLinks };
    if (pathname.startsWith('/fiscal')) return { title: 'Fiscal', links: fiscalLinks };
    if (pathname.startsWith('/pessoal')) return { title: 'Pessoal', links: pessoalLinks };
    if (pathname.startsWith('/contabil')) return { title: 'Contábil', links: contabilLinks };
    if (pathname.startsWith('/financeiro')) return { title: 'Financeiro', links: financeiroLinks };
    if (pathname.startsWith('/esocial') || pathname.startsWith('/pgdas') || pathname.startsWith('/efd-contribuicoes') || pathname.startsWith('/reinf') || pathname.startsWith('/conectividade')) return { title: 'Conectividade', links: conectividadeLinks };
    if (pathname.startsWith('/relatorios')) return { title: 'Relatórios', links: relatoriosLinks };
    if (pathname.startsWith('/parceiros') || pathname.startsWith('/funcionarios') || pathname.startsWith('/socios') || pathname.startsWith('/produtos') || pathname.startsWith('/servicos') || pathname.startsWith('/aliquotas') || pathname.startsWith('/rubricas') || pathname.startsWith('/fichas')) return { title: 'Cadastros', links: cadastroLinks };
    if (pathname.startsWith('/utilitarios')) return { title: 'Utilitários', links: utilitariosLinks };
    if (pathname.startsWith('/minha-empresa') || pathname.startsWith('/configuracoes') || pathname.startsWith('/admin')) return { title: 'Sistema', links: sistemaLinks };
    return { title: 'Navegação', links: mainNavLinks };
}


const Logo = () => {
  return (
    <Link
      href="/dashboard"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-8 w-8 bg-primary rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 flex items-center justify-center">
        <BookCheck className="h-6 w-6 text-white" />
      </div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-bold text-black dark:text-white whitespace-pre text-xl"
      >
        EscopoV3
      </motion.span>
    </Link>
  );
};


export function SidebarNav({ onHelpClick }: { onHelpClick: () => void }) {
  const pathname = usePathname();
  const { title, links } = getLinksForPath(pathname);

  return (
    <Sidebar>
      <SidebarBody className="justify-between">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4">
             <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          </div>
          <div className="mt-4 flex flex-col gap-2 px-2">
            {links.map((link) => (
              <SidebarLink key={link.label} link={link} />
            ))}
          </div>
        </div>
        <div className="p-2 border-t">
             <SidebarLink
                link={{
                label: 'Ajuda e Suporte',
                onClick: onHelpClick,
                icon: <LifeBuoy className="h-5 w-5 flex-shrink-0" />,
                }}
            />
        </div>
      </SidebarBody>
    </Sidebar>
  );
}
