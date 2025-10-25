
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '../ui/textarea';
import type { CalendarEvent } from '@/types/event';
import { DateInput } from '../ui/date-input';


interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  event: CalendarEvent | null;
  selectedDate?: Date | null;
}

const eventSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  date: z.date({ required_error: "Data é obrigatória." }),
});

export function EventFormModal({ isOpen, onClose, userId, companyId, event, selectedDate }: EventFormModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const modalKey = event?.id || selectedDate?.toISOString() || 'new-event';

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
  });

  const mode = event ? 'edit' : 'create';

  useEffect(() => {
    if (isOpen) {
        if (event) {
            form.reset({
                ...event,
                date: (event.date as any).toDate ? (event.date as any).toDate() : event.date,
            });
        } else {
            form.reset({
                title: '',
                description: '',
                date: selectedDate || new Date(),
            });
        }
    }
  }, [isOpen, event, selectedDate, form]);


  const onSubmit = async (values: z.infer<typeof eventSchema>) => {
    setLoading(true);
    try {
      const dataToSave = { ...values, createdAt: serverTimestamp() };
      
      if (mode === 'create') {
        const eventsRef = collection(db, `users/${userId}/companies/${companyId}/events`);
        await addDoc(eventsRef, dataToSave);
        toast({
          title: "Evento Agendado!",
          description: `O evento foi adicionado com sucesso.`,
        });
      } else if (event?.id) {
        const eventRef = doc(db, `users/${userId}/companies/${companyId}/events`, event.id);
        await setDoc(eventRef, dataToSave, { merge: true });
        toast({
          title: "Evento Atualizado!",
          description: `Os dados do evento foram atualizados.`,
        });
      }
      
      onClose();
    } catch (error) {
        console.error("Error saving event:", error);
        toast({
            variant: "destructive",
            title: "Erro ao salvar",
            description: "Não foi possível salvar os dados do evento."
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl" key={modalKey}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Agendar Novo Evento' : 'Alterar Evento'}</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para criar ou editar um compromisso.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
             <FormField control={form.control} name="date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data do Evento</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Título</FormLabel><FormControl><Input {...field} placeholder="Ex: Reunião de equipe" /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Descrição (Opcional)</FormLabel><FormControl><Textarea {...field} placeholder="Adicione detalhes sobre o evento..." /></FormControl><FormMessage /></FormItem> )} />
            
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Save />}
                {mode === 'create' ? 'Salvar Evento' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
