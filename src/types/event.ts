
import type { FieldValue } from "firebase/firestore";

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  date: FieldValue | Date;
  createdAt?: FieldValue | Date;
}
