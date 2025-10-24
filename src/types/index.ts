// Admin types

export interface Reservation {
  id: string;
  accommodationId: string;
  credentialId?: string;
  checkIn: string;
  checkOut: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  processedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Accommodation {
  id: string;
  name: string;
  description?: string;
  lockId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Credential {
  id: string;
  pin: string;
  isActive: boolean;
  expiresAt?: string;
  revokedAt?: string;
  lockId?: string;
  reservationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Stay {
  id: string;
  reservationId: string;
  accommodationId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  createdAt: string;
  updatedAt: string;
}
