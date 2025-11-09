
import type { FieldValue } from "firebase/firestore";

export type TicketStatus = 'open' | 'in_progress' | 'closed';

export interface Ticket {
  id?: string;
  ticketNumber: string;
  requesterName: string;
  requesterUid: string;
  requesterCompanyId: string;
  requesterCompanyName: string;
  requesterIdentifier?: string; // IP address or other identifier
  problemLocation: string;
  description: string;
  status: TicketStatus;
  createdAt: FieldValue | Date;
  updatedAt?: FieldValue | Date;
}
