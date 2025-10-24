
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '../ui/textarea';
import { AppUser } from '@/types';
import { sendNotification } from '@/services/notification-service';

interface NotificationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: Pick<AppUser, 'uid' | 'email'>;
}

const formSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  message: z.string().min(1, "A mensagem é obrigatória."),
});

type FormData = z.infer<typeof formSchema>;

export function NotificationFormModal({ isOpen, onClose, targetUser }: NotificationFormModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', message: '' },
  });

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      await sendNotification(targetUser.uid, values);
      toast({ title: "Notificação Enviada!", description: `A mensagem foi enviada para ${targetUser.email}.` });
      onClose();
    } catch (error) {
        console.error("Error sending notification:", error);
        toast({ variant: "destructive", title: "Erro ao Enviar", description: "Não foi possível enviar a notificação." });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Enviar Notificação</DialogTitle>
          <DialogDescription>
            Escreva uma mensagem que será enviada para o usuário <span className="font-semibold">{targetUser.email}</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Título</FormLabel><FormControl><Input {...field} placeholder="Ex: Atualização Importante" /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormLabel>Mensagem</FormLabel><FormControl><Textarea {...field} placeholder="Detalhes da sua mensagem..." rows={4} /></FormControl><FormMessage /></FormItem> )} />
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar Mensagem
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
