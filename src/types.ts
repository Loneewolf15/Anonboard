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
  videoUrls?: string[];    // Cloudinary video uploads (max 1 per drop)
  audioUrl?: string;       // Cloudinary audio upload for voice drops
  expiresAt?: Timestamp;   // Self-destruct TTL (future feature)
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
