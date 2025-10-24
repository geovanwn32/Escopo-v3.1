
import type { FieldValue } from 'firebase/firestore';

export interface AppUser {
  uid: string;
  email: string | null;
  createdAt: FieldValue;
  licenseType: 'pending_approval' | 'trial' | 'basica' | 'profissional' | 'premium';
  trialStartedAt?: FieldValue | Date;
  trialEndsAt?: FieldValue | Date;
}
