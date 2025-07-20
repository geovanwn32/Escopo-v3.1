
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import Link from 'next/link';
import { UserPlus, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

const formSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

export function RegisterForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Você será redirecionado para o login.',
      });
      router.push('/login');
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro no registo',
        description: error.code === 'auth/email-already-in-use' 
          ? 'Este email já está em uso.' 
          : 'Ocorreu um erro. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
     <div className="w-full h-screen lg:grid lg:grid-cols-2">
       <div className="flex items-center justify-center py-12">
        <Card className="w-full max-w-md mx-auto border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
                <UserPlus className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Crie a sua Conta</CardTitle>
            <CardDescription>É rápido e fácil.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="seu@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                  Registar
                </Button>
              </form>
            </Form>
            <p className="mt-4 text-center text-sm">
              Já tem uma conta?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Faça Login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="hidden bg-muted lg:flex items-center justify-center p-8">
         <Image 
            src="https://placehold.co/800x600.png" 
            alt="Placeholder Image" 
            width={800} 
            height={600}
            data-ai-hint="office workspace"
            className="rounded-lg shadow-2xl object-cover"
         />
      </div>
    </div>
  );
}
