
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Notification } from '@/types';

/**
 * Sends a notification to a specific user. It finds all companies for that user
 * and sends the notification to the first one found for simplicity.
 * A more robust solution might involve a user-specific notification collection or
 * sending to all companies.
 */
export async function sendNotification(
    targetUserId: string,
    data: { title: string; message: string }
) {
    if (!targetUserId) {
        throw new Error("Target user ID is required.");
    }
    
    // Find the first company for that user to send the notification to.
    const companiesRef = collection(db, `users/${targetUserId}/companies`);
    const companiesSnap = await getDocs(companiesRef);
    
    if (companiesSnap.empty) {
        // Fallback or error. For this implementation, we can't send a notification
        // if the user has no companies, as notifications are company-specific.
        throw new Error("O usuário alvo não possui empresas para receber a notificação.");
    }

    // Send notification to the first company found.
    const firstCompanyId = companiesSnap.docs[0].id;
    const notificationsRef = collection(db, `users/${targetUserId}/companies/${firstCompanyId}/notifications`);
    
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
