
import type { FieldValue } from "firebase/firestore";

export type EsocialEventStatus = 'pending' | 'processing' | 'success' | 'error';
export type EsocialEventType = 'S-1005' | 'S-1010' | 'S-1020' | 'S-2200' | 'S-1200' | 'S-1210' | 'S-1299';


export interface EsocialEvent {
    id?: string;
    type: EsocialEventType;
    status: EsocialEventStatus;
    payload: string; // This would hold the XML content
    errorDetails: string | null;
    createdAt: FieldValue | Date;
    updatedAt: FieldValue;
}
