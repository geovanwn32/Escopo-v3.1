
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase.tsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import Link from 'next/link';
import { UserPlus, Loader2, Eye, EyeOff, BookCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BackgroundPaths } from './background-paths';
import { addDays } from 'date-fns';

const formSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

const SUPER_ADMIN_EMAIL = 'geovaniwn@gmail.com';

export function RegisterForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      const isAdmin = values.email === SUPER_ADMIN_EMAIL;
      const licenseType = isAdmin ? 'premium' : 'pending_approval';
      const toastMessage = isAdmin 
        ? 'Conta de administrador criada com sucesso!'
        : 'Sua conta está aguardando liberação por um administrador.';

      // Create a user document in Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        createdAt: serverTimestamp(),
        licenseType: licenseType,
      });

      toast({
        title: 'Conta criada com sucesso!',
        description: toastMessage,
      });

      if (isAdmin) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
      
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast({
            variant: 'destructive',
            title: 'Erro no registo',
            description: 'Este email já está em uso.',
        });
      } else {
        toast({
            variant: 'destructive',
            title: 'Erro no registo',
            description: 'Ocorreu um erro. Tente novamente.',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <BackgroundPaths>
        <div className="w-full max-w-md space-y-8 z-10">
            <div className="text-center">
                <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl text-primary">
                    <BookCheck className="h-8 w-8" />
                    <span className="text-white">EscopoV3</span>
                </Link>
            </div>
            <Card className="shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-center text-2xl">Crie sua conta gratuita</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                            <div className="relative">
                            <Input 
                                type={showPassword ? 'text' : 'password'} 
                                placeholder="Mínimo 6 caracteres" 
                                {...field}
                                className="pr-10"
                            />
                            <button 
                                type="button" 
                                onClick={() => setShowPassword(!showPassword)} 
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                            >
                                {showPassword ? <EyeOff className="h-5 w-5"/> : <Eye className="h-5 w-5"/>}
                            </button>
                            </div>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Criar Conta
                    </Button>
                    <div className="text-center text-sm text-muted-foreground">
                        Já possui uma conta?{' '}
                        <Link href="/login" className="font-medium text-primary hover:underline">
                            Acesse aqui
                        </Link>
                    </div>
                </form>
                </Form>
            </CardContent>
            </Card>
        </div>
    </BackgroundPaths>
  );
}
