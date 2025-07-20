"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookCheck } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
        <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
            <BookCheck className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Bem-vindo ao Contabilizei
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl">
            Sua plataforma completa para gestão contábil. Acesse seu painel ou crie uma conta para começar.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button asChild>
                <Link href="/login">Fazer Login</Link>
            </Button>
            <Button variant="outline" asChild>
                <Link href="/register">Criar Conta &rarr;</Link>
            </Button>
        </div>
    </div>
  );
}
