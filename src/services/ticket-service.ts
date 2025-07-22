import { collection, addDoc, serverTimestamp, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Ticket } from '@/types/ticket';

// Creates a new support ticket in a global 'tickets' collection.
export async function createSupportTicket(
    data: Omit<Ticket, 'id' | 'ticketNumber' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
    const ticketsRef = collection(db, 'tickets');

    // Generate a new ticket number
    const q = query(ticketsRef, orderBy('createdAt', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    let lastTicketNumber = 1000;
    if (!querySnapshot.empty) {
        const lastTicket = querySnapshot.docs[0].data();
        lastTicketNumber = parseInt(lastTicket.ticketNumber.replace('T', ''), 10);
    }
    const newTicketNumber = `T${lastTicketNumber + 1}`;

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
