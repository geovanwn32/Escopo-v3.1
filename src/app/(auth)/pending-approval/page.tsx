
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase.tsx";
import { signOut } from "firebase/auth";
import { Clock, Mail, LogOut, BookCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PendingApprovalPage() {
    const { user } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
            <div className="w-full max-w-md space-y-6 text-center">
                 <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl text-primary">
                    <BookCheck className="h-8 w-8" />
                    <span>EscopoV3</span>
                </Link>
                <Card className="shadow-lg">
                    <CardHeader>
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Clock className="h-8 w-8" />
                        </div>
                        <CardTitle className="mt-4 text-2xl">Aguardando Liberação</CardTitle>
                        <CardDescription>
                           Sua conta foi criada com sucesso e está aguardando a aprovação de um administrador.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Você receberá uma notificação por e-mail assim que sua conta for liberada. 
                            Se tiver alguma dúvida, entre em contato com nosso suporte.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                             <Button className="w-full" asChild>
                                <a href="mailto:geovaniwn@gmail.com">
                                    <Mail className="mr-2 h-4 w-4"/>
                                    Entrar em Contato
                                </a>
                            </Button>
                             <Button variant="outline" className="w-full" onClick={handleLogout}>
                                <LogOut className="mr-2 h-4 w-4"/>
                                Fazer Logout
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
