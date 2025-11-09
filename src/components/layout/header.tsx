
"use client";

import * as React from "react";
import { signOut } from "firebase/auth";
import { LogOut, Repeat, UserCircle, Settings, Menu, LayoutDashboard, Search, Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase.tsx";
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
import { cn } from "@/lib/utils";
import { mainNavLinks } from "./sidebar-nav"; // Import main navigation links
import { NotificationCenter } from "./notification-center";

export function Header({ activeCompany, onSwitchCompany }: { activeCompany: any; onSwitchCompany: () => void; }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { open, setOpen } = useSidebar();
  
  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
       <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="md:hidden" // Only show on mobile
              onClick={() => setOpen(!open)}
            >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
            </Button>
            <nav className="hidden items-center gap-2 text-sm font-medium md:flex">
                {mainNavLinks.map((link) => (
                     <Link
                        key={link.label}
                        href={link.href}
                        className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 transition-colors",
                        pathname.startsWith(link.href)
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {link.icon && React.cloneElement(link.icon, { className: 'h-4 w-4' })}
                        {link.label}
                    </Link>
                ))}
            </nav>
        </div>
      <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
        {user && activeCompany && <NotificationCenter userId={user.uid} companyId={activeCompany.id} />}

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
