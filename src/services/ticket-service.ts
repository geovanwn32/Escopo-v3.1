
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Ticket, Company } from '@/types';

/**
 * Creates a new support ticket.
 * It now fetches the company's pseudoIp and saves it as the requesterIdentifier.
 */
export async function createSupportTicket(
    data: Omit<Ticket, 'id' | 'ticketNumber' | 'status' | 'createdAt' | 'updatedAt' | 'requesterIdentifier'>
): Promise<string> {
    const { requesterUid, requesterCompanyId } = data;

    if (!requesterUid || !requesterCompanyId) {
        throw new Error("UID do usuário e ID da empresa são obrigatórios.");
    }

    // Fetch the company document to get the pseudoIp
    const companyRef = doc(db, `users/${requesterUid}/companies/${requesterCompanyId}`);
    const companySnap = await getDoc(companyRef);
    const companyData = companySnap.data() as Company | undefined;
    const requesterIdentifier = companyData?.pseudoIp || 'N/A';
    
    const ticketsRef = collection(db, `users/${requesterUid}/companies/${requesterCompanyId}/tickets`);

    // Find the last ticket number to increment it.
    const q = query(ticketsRef, orderBy("ticketNumber", "desc"), limit(1));
    const lastTicketSnap = await getDocs(q);
    let lastNumber = 0;
    if (!lastTicketSnap.empty) {
        const lastTicketData = lastTicketSnap.docs[0].data();
        const numPart = lastTicketData.ticketNumber.split('-')[1];
        lastNumber = parseInt(numPart) || 0;
    }
    const newTicketNumber = `T-${String(lastNumber + 1).padStart(4, '0')}`;

    const newTicket: Omit<Ticket, 'id'> = {
        ...data,
        ticketNumber: newTicketNumber,
        requesterIdentifier,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await addDoc(ticketsRef, newTicket);
    return newTicketNumber;
}
