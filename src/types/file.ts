
import type { FieldValue } from "firebase/firestore";

export interface StoredFile {
  id?: string;
  name: string;
  url: string;
  type: string;
  size: number;
  storagePath: string;
  createdAt: FieldValue | Date;
}

    