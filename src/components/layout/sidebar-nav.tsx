
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
} from "lucide-react"
import { useAuth } from "@/lib/auth"

const ADMIN_COMPANY_CNPJ = '00000000000000';

const menuGroups = [
  {
    section: "Principal",
    items: [
      { href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0" />, label: "Dashboard" },
      { href: "/fiscal", icon: <FileStack className="h-5 w-5 flex-shrink-0" />, label: "Módulo Fiscal" },
      { href: "/pessoal", icon: <Users className="h-5 w-5 flex-shrink-0" />, label: "Módulo Pessoal" },
      { href: "/contabil", icon: <BookCopy className="h-5 w-5 flex-shrink-0" />, label: "Módulo Contábil" },
    ],
  },
  {
    section: "Cadastros",
    items: [
      { href: "/parceiros", icon: <Handshake className="h-5 w-5 flex-shrink-0" />, label: "Parceiros" },
      { href: "/funcionarios", icon: <UserCog className="h-5 w-5 flex-shrink-0" />, label: "Funcionários" },
      { href: "/socios", icon: <Briefcase className="h-5 w-5 flex-shrink-0" />, label: "Sócios" },
      { href: "/produtos", icon: <Package className="h-5 w-5 flex-shrink-0" />, label: "Produtos" },
      { href: "/servicos", icon: <Wrench className="h-5 w-5 flex-shrink-0" />, label: "Serviços" },
      { href: "/aliquotas", icon: <Percent className="h-5 w-5 flex-shrink-0" />, label: "Alíquotas" },
      { href: "/rubricas", icon: <FileText className="h-5 w-5 flex-shrink-0" />, label: "Rubricas" },
      { href: "/fichas", icon: <BookUser className="h-5 w-5 flex-shrink-0" />, label: "Fichas" },
    ],
  },
  {
    section: "Conectividade",
    items: [
        { href: "/esocial", icon: <Share2 className="h-5 w-5 flex-shrink-0" />, label: "eSocial" },
        { href: "/pgdas", icon: <Calculator className="h-5 w-5 flex-shrink-0" />, label: "PGDAS" },
    ],
  },
   {
    section: "Utilitários",
    items: [
        { href: "/utilitarios/eventos", icon: <Calendar className="h-5 w-5 flex-shrink-0" />, label: "Agenda" },
        { href: "/utilitarios/links", icon: <LinkIcon className="h-5 w-5 flex-shrink-0" />, label: "Links Úteis" },
        { href: "/utilitarios/arquivos", icon: <Archive className="h-5 w-5 flex-shrink-0" />, label: "Arquivos" },
    ],
  },
  {
    section: "Sistema",
    items: [
      { href: "/relatorios", icon: <BarChart3 className="h-5 w-5 flex-shrink-0" />, label: "Relatórios" },
      { href: "/minha-empresa", icon: <Building2 className="h-5 w-5 flex-shrink-0" />, label: "Minha Empresa" },
      { href: "/configuracoes", icon: <Settings className="h-5 w-5 flex-shrink-0" />, label: "Configurações" },
      { href: "/admin", icon: <Shield className="h-5 w-5 flex-shrink-0" />, label: "Admin", adminOnly: true },
    ],
  },
];

const Logo = () => {
  return (
    <Link
      href="/dashboard"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-7 w-7 bg-primary rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 flex items-center justify-center">
        <BookCheck className="h-5 w-5 text-white" />
      </div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-bold text-black dark:text-white whitespace-pre text-lg"
      >
        Escopo
      </motion.span>
    </Link>
  );
};

const LogoIcon = () => {
  return (
    <Link
      href="/dashboard"
      className="font-normal flex flex-col items-center justify-center text-sm text-black py-1 relative z-20"
    >
       <div className="h-7 w-7 bg-primary rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 flex items-center justify-center">
        <BookCheck className="h-5 w-5 text-white" />
      </div>
      <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300 mt-1">
        Escopo
      </span>
    </Link>
  );
};


export function SidebarNav({ activeCompany, onHelpClick }: { activeCompany: any, onHelpClick: () => void }) {
  const { open } = useSidebar();

  const isAdminCompany = activeCompany?.cnpj === ADMIN_COMPANY_CNPJ;

  return (
    <Sidebar>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-2">
            {open ? <Logo /> : <LogoIcon />}
          </div>
          <div className="mt-8 flex flex-col gap-2">
            {menuGroups.map((group) => (
              <div key={group.section} className="px-2">
                {open && <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.section}</span>}
                {group.items.map((link) => {
                  if (link.adminOnly && !isAdminCompany) {
                    return null;
                  }
                  return <SidebarLink key={link.label} link={link} />
                })}
                 {group.section === 'Sistema' && (
                    <SidebarLink
                      link={{
                        label: 'Ajuda',
                        onClick: onHelpClick,
                        icon: <LifeBuoy className="h-5 w-5 flex-shrink-0" />,
                      }}
                    />
                 )}
              </div>
            ))}
          </div>
        </div>
        <div>
           <SidebarLink
              link={{
                label: activeCompany?.nomeFantasia || 'N/A',
                href: "/minha-empresa",
                icon: (
                   <Building2 className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                ),
              }}
            />
        </div>
      </SidebarBody>
    </Sidebar>
  );
}
