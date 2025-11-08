
"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, FileWarning, CheckCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Notification } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationCenterProps {
    userId: string;
    companyId: string;
}

export function NotificationCenter({ userId, companyId }: NotificationCenterProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!userId || !companyId) return;

        const notificationsRef = collection(db, `users/${userId}/companies/${companyId}/notifications`);
        const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(10));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => {
                const data = doc.data();
                // Safely convert timestamp to Date
                const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function' 
                    ? data.createdAt.toDate() 
                    : null;
                return { id: doc.id, ...data, createdAt } as Notification;
            });
            setNotifications(notifs);
            const unread = notifs.filter(n => !n.isRead).length;
            setUnreadCount(unread);
        });

        return () => unsubscribe();
    }, [userId, companyId]);

    const handleMarkAsRead = async (notificationId: string) => {
        if (!userId || !companyId) return;
        const notifRef = doc(db, `users/${userId}/companies/${companyId}/notifications`, notificationId);
        await updateDoc(notifRef, { isRead: true });
    };

    const handleMarkAllAsRead = async () => {
        if (!userId || !companyId || unreadCount === 0) return;
        
        const unreadNotifs = notifications.filter(n => !n.isRead);
        for(const notif of unreadNotifs) {
            if(notif.id) {
                const notifRef = doc(db, `users/${userId}/companies/${companyId}/notifications`, notif.id);
                await updateDoc(notifRef, { isRead: true });
            }
        }
    };
    
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                 <Button variant="outline" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{unreadCount}</Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
                <div className="p-4 border-b">
                    <h4 className="font-medium">Notificações</h4>
                </div>
                 <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground p-8">
                           <FileWarning className="mx-auto h-8 w-8 mb-2"/>
                           Nenhuma notificação encontrada.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map(notif => (
                                <div key={notif.id} className={`p-4 ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                    <h5 className="font-semibold text-sm">{notif.title}</h5>
                                    <p className="text-xs text-muted-foreground">{notif.message}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-xs text-muted-foreground/80">
                                            {notif.createdAt instanceof Date
                                                ? formatDistanceToNow(notif.createdAt, { addSuffix: true, locale: ptBR })
                                                : 'agora mesmo'}
                                        </p>
                                        {!notif.isRead && (
                                            <Button variant="ghost" size="sm" className="h-auto p-1 text-xs" onClick={() => handleMarkAsRead(notif.id!)}>
                                                Marcar como lida
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
                 {notifications.length > 0 && (
                    <div className="p-2 border-t">
                        <Button variant="link" size="sm" className="w-full" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
                            <CheckCheck className="mr-2 h-4 w-4"/>
                            Marcar todas como lidas
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
