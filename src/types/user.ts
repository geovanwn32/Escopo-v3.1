
import type { FieldValue } from 'firebase/firestore';

export interface AppUser {
  uid: string;
  email: string | null;
  createdAt: FieldValue;
  trialStartedAt: FieldValue;
  trialEndsAt: FieldValue | Date;
  licenseType?: 'trial' | 'basica' | 'profissional' | 'premium';
}
