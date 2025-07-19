"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import {
  BookCheck,
  LayoutDashboard,
  FileStack,
  BookOpen,
  Users,
  Building2,
  Handshake,
  UserCog,
  Package,
  Wrench,
  Percent,
  BarChart3,
  Settings,
} from "lucide-react"

const menuItems = [
  {
    section: "Principal",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/fiscal", icon: FileStack, label: "Módulo Fiscal" },
      { href: "/contabil", icon: BookOpen, label: "Módulo Contábil" },
      { href: "/pessoal", icon: Users, label: "Módulo Pessoal" },
    ],
  },
  {
    section: "Cadastros",
    items: [
      { href: "/empresas", icon: Building2, label: "Empresas" },
      { href: "/parceiros", icon: Handshake, label: "Parceiros" },
      { href: "/funcionarios", icon: UserCog, label: "Funcionários" },
      { href: "/produtos", icon: Package, label: "Produtos" },
      { href: "/servicos", icon: Wrench, label: "Serviços" },
      { href: "/aliquotas", icon: Percent, label: "Alíquotas" },
    ],
  },
  {
    section: "Sistema",
    items: [
      { href: "/relatorios", icon: BarChart3, label: "Relatórios" },
      { href: "/configuracao", icon: Settings, label: "Configurações" },
    ],
  },
]

export function SidebarNav({ activeCompany }: { activeCompany: any }) {
  const pathname = usePathname()

  return (
    <Sidebar
      className="border-r"
      collapsible="icon"
      variant="sidebar"
    >
      <SidebarHeader className="h-14 justify-center text-background group-data-[collapsible=icon]:justify-center">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-sidebar-foreground">
          <BookCheck className="size-7 text-primary" />
          <span className="group-data-[collapsible=icon]:hidden">Escopo</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex-1 p-2">
        {menuItems.map((section) => (
          <SidebarGroup key={section.section}>
            <SidebarGroupLabel>{section.section}</SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href} passHref>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-2">
        <div className="rounded-md border p-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:border-0">
            <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:justify-center">
                 <Building2 className="size-5 shrink-0" />
                 <div className="flex flex-col text-sm group-data-[collapsible=icon]:hidden">
                     <span className="font-semibold text-sidebar-foreground">{activeCompany?.nomeFantasia || "N/A"}</span>
                     <span className="text-xs text-sidebar-foreground/70">{activeCompany?.cnpj || "Nenhum CNPJ"}</span>
                 </div>
            </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
