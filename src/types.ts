import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  watermark: string;
  watermarkFont?: string;
  watermarkColor?: string;
  watermarkPosition?: 'bottom' | 'top' | 'center';
  createdAt: Timestamp;
}

export interface Message {
  id: string;
  content: string;
  category?: string;
  reactions: Record<string, number>;
  createdAt: Timestamp;
  recipientUid: string;
  imageUrls?: string[];
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}
