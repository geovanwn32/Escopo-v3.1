
"use client";

import { signOut } from "firebase/auth";
import { LogOut, Repeat, UserCircle, Settings, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "../ui/sidebar";


export function Header({ activeCompany, onSwitchCompany }: { activeCompany: any; onSwitchCompany: () => void; }) {
  const { user } = useAuth();
  const router = useRouter();
  const { open, setOpen } = useSidebar();

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
       <div className="flex items-center gap-2">
            <Menu className="h-6 w-6 cursor-pointer md:hidden" onClick={() => setOpen(!open)} />
        </div>
      <div className="flex flex-1 items-center justify-end gap-4">
         <Button variant="outline" size="sm" onClick={onSwitchCompany} className="hidden sm:inline-flex">
            <Repeat className="mr-2 h-4 w-4" />
            Trocar Empresa
        </Button>
        <div className="text-right hidden sm:block">
            <p className="font-semibold text-sm">{activeCompany?.nomeFantasia || "Nenhuma empresa selecionada"}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <UserCircle className="h-6 w-6" />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/minha-empresa')}>
              <Settings className="mr-2 h-4 w-4" />
              Minha Empresa
            </DropdownMenuItem>
             <DropdownMenuItem onClick={onSwitchCompany}>
              <Repeat className="mr-2 h-4 w-4" />
              Trocar Empresa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
