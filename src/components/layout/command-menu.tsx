
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandItem,
} from "@/components/ui/command"
import { mainNavLinks, fiscalLinks, pessoalLinks, contabilLinks, financeiroLinks, cadastroLinks, conectividadeLinks, utilitariosLinks, sistemaLinks } from "./sidebar-nav"
import { DialogTitle } from "@radix-ui/react-dialog"

const commandGroups = [
  { heading: 'Navegação Principal', links: mainNavLinks },
  { heading: 'Fiscal', links: fiscalLinks },
  { heading: 'Pessoal', links: pessoalLinks },
  { heading: 'Contábil', links: contabilLinks },
  { heading: 'Financeiro', links: financeiroLinks },
  { heading: 'Cadastros', links: cadastroLinks },
  { heading: 'Conectividade', links: conectividadeLinks },
  { heading: 'Utilitários', links: utilitariosLinks },
  { heading: 'Sistema', links: sistemaLinks.filter(l => !l.adminOnly) },
];

function CommandMenuContent({ setOpen }: { setOpen: (open: boolean) => void }) {
  const router = useRouter();

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [setOpen])

  return (
    <>
      <CommandInput placeholder="Digite um comando ou busque uma página..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {commandGroups.map((group) => (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.links.map((link) => (
              <CommandItem
                key={link.href}
                value={`${group.heading}-${link.label}`}
                onSelect={() => {
                  runCommand(() => router.push(link.href as string))
                }}
              >
                {React.cloneElement(link.icon as React.ReactElement, { className: "mr-2 h-4 w-4" })}
                <span>{link.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </>
  );
}

export function CommandMenu({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <DialogTitle className="sr-only">Command Menu</DialogTitle>
      <CommandMenuContent setOpen={setOpen} />
    </CommandDialog>
  )
}
