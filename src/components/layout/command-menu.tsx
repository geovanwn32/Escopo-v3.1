
"use client"

import * as React from "react"
import {
  Calculator,
  Calendar,
  FileStack,
  Settings,
  User,
  LayoutDashboard,
  Users,
  BookCopy,
  Landmark,
  Handshake,
  BarChart3,
  LifeBuoy
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { mainNavLinks, fiscalLinks, pessoalLinks, contabilLinks, financeiroLinks, cadastroLinks, conectividadeLinks, utilitariosLinks, sistemaLinks } from "./sidebar-nav"
import { useRouter } from "next/navigation"

export function CommandMenu({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return
        }

        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [setOpen])
  
  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [setOpen])

  const commandGroups = [
    { heading: 'Navegação Principal', links: mainNavLinks },
    { heading: 'Fiscal', links: fiscalLinks },
    { heading: 'Pessoal', links: pessoalLinks },
    { heading: 'Contábil', links: contabilLinks },
    { heading: 'Financeiro', links: financeiroLinks },
    { heading: 'Cadastros', links: cadastroLinks },
    { heading: 'Conectividade', links: conectividadeLinks },
    { heading: 'Utilitários', links: utilitariosLinks },
    { heading: 'Sistema', links: sistemaLinks.filter(l => !l.adminOnly) }, // hide admin link from command
  ];


  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Digite um comando ou busque uma página..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {commandGroups.map(group => (
            <CommandGroup key={group.heading} heading={group.heading}>
              {group.links.map(link => (
                <CommandItem
                  key={link.href}
                  value={`${group.heading} ${link.label}`}
                  onSelect={() => {
                    if (link.href) {
                      runCommand(() => router.push(link.href!))
                    } else if (link.onClick) {
                      runCommand(link.onClick)
                    }
                  }}
                >
                  {React.cloneElement(link.icon as React.ReactElement, { className: "mr-2 h-4 w-4" })}
                  <span>{link.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
