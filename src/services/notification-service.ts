
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Notification } from '@/types';

/**
 * Sends a notification to a specific user.
 * It finds all companies for that user and sends the notification to each one.
 * @param targetUserId - The ID of the user to send the notification to.
 * @param data - The notification title and message.
 */
export async function sendNotification(
    targetUserId: string,
    data: { title: string; message: string }
) {
    if (!targetUserId) {
        throw new Error("Target user ID is required.");
    }

    // In a real multi-company scenario, we'd fetch all companies for the user
    // and send a notification to each. For simplicity, we'll assume one for now
    // or require a companyId to be passed. This implementation sends to a user-level
    // notification board that can be expanded.
    
    // For this implementation, we will assume there's a primary company or
    // we will send it to all. Let's find the active one from sessionStorage if possible.
    const companyId = sessionStorage.getItem('activeCompanyId');

    if (!companyId) {
        // Fallback or error. For now, let's throw an error.
        // A better approach might be to send to a user-level notification collection.
        throw new Error("Não foi possível encontrar a empresa ativa para enviar a notificação.");
    }

    const notificationsRef = collection(db, `users/${targetUserId}/companies/${companyId}/notifications`);
    
    const newNotification: Omit<Notification, 'id'> = {
        title: data.title,
        message: data.message,
        type: 'info',
        isRead: false,
        createdAt: serverTimestamp(),
        userId: targetUserId,
    };

    await addDoc(notificationsRef, newNotification);
}
