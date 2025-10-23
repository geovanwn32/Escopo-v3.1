
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookCheck, CheckCircle } from 'lucide-react';
import Image from 'next/image';

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
     <div className="min-h-screen bg-background text-foreground">
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
            {/* Image Section */}
            <div className="relative hidden lg:block">
                 <Image
                    src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2070&auto=format&fit=crop"
                    alt="Pessoa trabalhando em uma mesa com laptop e documentos financeiros"
                    layout="fill"
                    objectFit="cover"
                    data-ai-hint="finance work"
                    className="h-full w-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                <div className="absolute bottom-10 left-10 text-white">
                    <h2 className="text-3xl font-bold">Organização e Eficiência</h2>
                    <p className="mt-2 max-w-md">Transforme a complexidade fiscal e contábil em simplicidade e clareza.</p>
                </div>
            </div>

            {/* Content Section */}
            <div className="flex flex-col items-center justify-center p-8 lg:p-12">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[380px]">
                    <div className="flex flex-col space-y-2 text-center">
                        <div className="inline-flex items-center justify-center gap-2 font-bold text-2xl text-primary">
                            <BookCheck className="h-8 w-8" />
                            <h1 className="text-2xl font-semibold tracking-tight">EscopoV3</h1>
                        </div>
                        <p className="text-sm text-muted-foreground">Sua contabilidade, descomplicada.</p>
                    </div>

                    <div className="text-center space-y-6">
                        <ul className="space-y-2 text-left">
                            <li className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500"/>
                                <span>Gestão Fiscal e Contábil completa.</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500"/>
                                <span>Cálculos de Folha de Pagamento precisos.</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500"/>
                                <span>Relatórios detalhados para tomada de decisão.</span>
                            </li>
                        </ul>
                        <div className="flex flex-col space-y-2">
                             <Button asChild>
                                <Link href="/register">Comece agora</Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href="/login">Já tenho uma conta</Link>
                            </Button>
                        </div>
                    </div>
                     <p className="px-8 text-center text-xs text-muted-foreground">
                        Ao se registrar, você concorda com nossos{' '}
                        <Link href="#" className="underline underline-offset-4 hover:text-primary">
                            Termos de Serviço
                        </Link>{' '}
                        e{' '}
                        <Link href="#" className="underline underline-offset-4 hover:text-primary">
                            Política de Privacidade
                        </Link>
                        .
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
}

