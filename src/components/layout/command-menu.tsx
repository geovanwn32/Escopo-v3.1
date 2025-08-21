
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

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

export function CommandMenu({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [setOpen])


  const runCommand = (callback: () => unknown) => {
    setOpen(false)
    callback()
  }

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
          group.links.length > 0 && (
            <CommandGroup key={group.heading} heading={group.heading}>
              {group.links.map(link => (
                <CommandItem
                  key={link.href || link.label}
                  value={`${group.heading}-${link.label}`}
                  onSelect={() => {
                    runCommand(() => {
                        if (link.href) router.push(link.href)
                        else if (link.onClick) link.onClick()
                    });
                  }}
                >
                  {React.cloneElement(link.icon as React.ReactElement, { className: "mr-2 h-4 w-4" })}
                  <span>{link.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )
        ))}
      </CommandList>
    </CommandDialog>
  )
}
