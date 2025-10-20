
import type { FieldValue } from "firebase/firestore";

export type EsocialEventStatus = 'pending' | 'processing' | 'success' | 'error';
export type EsocialEventType = 'S-1005' | 'S-1010' | 'S-1020' | 'S-2190' | 'S-2200' | 'S-1200' | 'S-1210' | 'S-1299';


export interface EsocialEvent {
    id?: string;
    eventId?: string;
    type: EsocialEventType;
    status: EsocialEventStatus;
    payload: string; // This would hold the XML content
    errorDetails: string | null;
    receiptNumber?: string; // To store the receipt number from the government
    period?: string; // For periodic events, e.g., "07/2024"
    createdAt: FieldValue | Date;
    updatedAt: FieldValue;
    relatedDocId?: string;
    relatedCollection?: string;
    relatedDoc?: any; // To hold the fetched related document data
}
