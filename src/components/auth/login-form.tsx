
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase.tsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import Link from 'next/link';
import { LogIn, Loader2, Eye, EyeOff, BookCheck, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { BackgroundPaths } from './background-paths';

const loginFormSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(1, { message: 'A senha é obrigatória.' }),
  rememberMe: z.boolean().default(false),
});

const resetPasswordSchema = z.object({
    email: z.string().email({ message: 'Por favor, insira um email válido para redefinir a senha.' }),
});

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const loginForm = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const resetForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
        email: '',
    }
  });

  async function onLoginSubmit(values: z.infer<typeof loginFormSchema>) {
    setLoading(true);
    try {
      await setPersistence(auth, values.rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: 'Login bem-sucedido!',
        description: 'Redirecionando para o dashboard...',
        variant: 'success',
      });
      router.push('/dashboard');
    } catch (error: any) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            loginForm.setError('password', {
                type: 'manual',
                message: 'E-mail ou senha inválidos.'
            });
        } else {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Erro no login',
                description: 'Ocorreu um erro inesperado. Por favor, tente novamente.',
            });
        }
    } finally {
      setLoading(false);
    }
  }
  
  async function onResetPasswordSubmit(values: z.infer<typeof resetPasswordSchema>) {
    setIsSendingReset(true);
    try {
        await sendPasswordResetEmail(auth, values.email);
        toast({
            title: "Email de redefinição enviado!",
            description: "Verifique sua caixa de entrada (e spam) para redefinir sua senha.",
            variant: "success",
        });
        setIsResetModalOpen(false);
    } catch(error) {
        console.error(error);
        toast({
            variant: "destructive",
            title: "Erro ao enviar email",
            description: "Não foi possível enviar o email de redefinição. Verifique o email e tente novamente."
        })
    } finally {
        setIsSendingReset(false);
    }
  }

  const handleOpenResetModal = () => {
    const email = loginForm.getValues('email');
    if (email) {
        resetForm.setValue('email', email);
    }
    setIsResetModalOpen(true);
  };

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
            <CardTitle className="text-center text-2xl">Acesse sua conta</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                <FormField
                  control={loginForm.control}
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
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? 'text' : 'password'} 
                            placeholder="••••••••" 
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
                 <div className="flex items-center justify-between">
                    <FormField
                    control={loginForm.control}
                    name="rememberMe"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                            <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>
                            Lembrar-me
                            </FormLabel>
                        </div>
                        </FormItem>
                    )}
                    />
                    <div className="text-sm">
                        <Button type="button" variant="link" className="p-0 h-auto font-medium text-primary hover:underline" onClick={handleOpenResetModal}>
                            Esqueceu a senha?
                        </Button>
                    </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  Entrar na Plataforma
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                    Não tem uma conta?{' '}
                    <Link href="/register" className="font-medium text-primary hover:underline">
                        Registe-se
                    </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="sm:max-w-md">
             <Form {...resetForm}>
                <form onSubmit={resetForm.handleSubmit(onResetPasswordSubmit)}>
                    <DialogHeader>
                        <DialogTitle>Redefinir Senha</DialogTitle>
                        <DialogDescription>
                            Digite seu email cadastrado e enviaremos um link para você redefinir sua senha.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                         <FormField
                            control={resetForm.control}
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
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary" disabled={isSendingReset}>Cancelar</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSendingReset}>
                             {isSendingReset ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                            Enviar Link
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </BackgroundPaths>
  );
}
