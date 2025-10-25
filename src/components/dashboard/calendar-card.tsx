
"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/event";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface CalendarCardProps {
    companyId: string;
    onDayClick: (date: Date) => void;
}

export function CalendarCard({ companyId, onDayClick }: CalendarCardProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    useEffect(() => {
        if (!user || !companyId) return;

        const eventsRef = collection(db, `users/${user.uid}/companies/${companyId}/events`);
        const q = query(eventsRef, orderBy("date", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: (doc.data().date as any).toDate(),
            } as CalendarEvent));
            setEvents(eventsData);
        }, (error) => {
            console.error("Error fetching events for calendar:", error);
            toast({ variant: 'destructive', title: 'Erro ao carregar eventos do calendário.' });
        });

        return () => unsubscribe();
    }, [user, companyId, toast]);

    const eventDates = useMemo(() => events.map(event => event.date as Date), [events]);

    return (
        <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            onDayClick={onDayClick}
            className="rounded-md border"
            modifiers={{
                events: eventDates
            }}
            modifiersClassNames={{
                events: "relative before:content-[''] before:absolute before:bottom-1 before:left-1/2 before:-translate-x-1/2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-primary"
            }}
        />
    );
}
