
import type { FieldValue } from "firebase/firestore";

export type ReinfEventType = 'R-1000' | 'R-1070' | 'R-2010' | 'R-2020' | 'R-2099' | 'R-4010' | 'R-4020';
export type ReinfEventStatus = 'pending' | 'success' | 'error';

export interface ReinfFile {
  id?: string;
  fileName: string;
  period: string;
  type: ReinfEventType;
  status: ReinfEventStatus;
  createdAt: FieldValue | Date;
  userId: string;
  companyId: string;
}
