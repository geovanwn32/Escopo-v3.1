
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Loader2, BookCheck, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { BackgroundPaths } from '@/components/auth/background-paths';

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
    <BackgroundPaths>
      <div className="relative z-10 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <Card className="bg-card/60 backdrop-blur-sm shadow-2xl">
            <CardHeader className="items-center text-center">
               <div className="inline-flex items-center justify-center gap-2 font-bold text-2xl text-primary mb-2">
                  <BookCheck className="h-8 w-8" />
                  <h1 className="text-2xl font-semibold tracking-tight">EscopoV3</h1>
              </div>
              <CardTitle>Sua contabilidade, descomplicada.</CardTitle>
              <CardDescription>
                Tudo que você precisa para gerenciar sua empresa com eficiência e clareza.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Button asChild size="lg">
                    <Link href="/register">Começar agora (Grátis)</Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                    <Link href="/login">Já tenho uma conta</Link>
                </Button>

                <div className="space-y-2 text-sm pt-4">
                    <p className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-4 w-4 text-green-500" /> Gestão Fiscal e Contábil</p>
                    <p className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-4 w-4 text-green-500" /> Folha de Pagamento Completa</p>
                    <p className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-4 w-4 text-green-500" /> Relatórios Inteligentes</p>
                </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </BackgroundPaths>
  );
}
