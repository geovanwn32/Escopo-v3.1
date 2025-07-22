
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Ticket } from '@/types/ticket';

/**
 * Creates a new support ticket in a global 'tickets' collection.
 * The ticket number is now generated using a timestamp for uniqueness,
 * avoiding a read operation before write.
 */
export async function createSupportTicket(
    data: Omit<Ticket, 'id' | 'ticketNumber' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
    const ticketsRef = collection(db, 'tickets');

    // Generate a new ticket number based on timestamp for uniqueness and simplicity.
    // This avoids needing list permissions on the collection for all users.
    const timestamp = Date.now();
    const newTicketNumber = `T-${String(timestamp).slice(-6)}`;

    const newTicket: Omit<Ticket, 'id'> = {
        ...data,
        ticketNumber: newTicketNumber,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await addDoc(ticketsRef, newTicket);
    return newTicketNumber;
}
