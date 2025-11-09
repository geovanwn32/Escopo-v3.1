
import type { FieldValue } from "firebase/firestore";

export type TicketStatus = 'open' | 'in_progress' | 'closed';

export interface Ticket {
  id?: string;
  ticketNumber: string;
  requesterName: string;
  requesterUid: string;
  requesterCompanyId: string;
  requesterCompanyName: string;
  requesterIp?: string; // IP address of the user who created the ticket
  problemLocation: string;
  description: string;
  status: TicketStatus;
  createdAt: FieldValue | Date;
  updatedAt?: FieldValue | Date;
}
