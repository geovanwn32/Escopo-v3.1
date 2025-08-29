
import type { FieldValue } from "firebase/firestore";

export type ReinfEventType = 
    | 'R-1000' 
    | 'R-1070' 
    | 'R-2010' 
    | 'R-2020'
    | 'R-2030'
    | 'R-2040'
    | 'R-2050'
    | 'R-2055'
    | 'R-2060' 
    | 'R-2099' 
    | 'R-4010' 
    | 'R-4020';

export type ReinfEventStatus = 'pending' | 'success' | 'error';

export interface ReinfFile {
  id?: string;
  eventId: string;
  period: string;
  type: ReinfEventType;
  status: ReinfEventStatus;
  relatedLaunchIds: string[]; // IDs of the launches that make up this event
  createdAt: FieldValue | Date;
  userId: string;
  companyId: string;
  payload: string; // XML content of the event
}
