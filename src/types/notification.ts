
import type { FieldValue } from "firebase/firestore";

export interface Notification {
    id?: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    isRead: boolean;
    createdAt: FieldValue | Date;
    userId: string; // ID of the user who should see this
    notificationKey?: string; // Unique key to prevent duplicates
}
