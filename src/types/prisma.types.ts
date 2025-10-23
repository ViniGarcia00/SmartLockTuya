/**
 * Tipos e Interfaces Prisma para SmartLock Tuya
 * 
 * Arquivo auxiliar para tipagem completa de operações com banco de dados
 */

import {
  Accommodation,
  Lock,
  AccommodationLock,
  Reservation,
  Credential,
  WebhookEvent,
  AuditLog,
  AccommodationStatus,
  LockVendor,
  ReservationStatus,
  CredentialStatus,
} from "@prisma/client";

// Re-exports para facilitar importação
export type {
  Accommodation,
  Lock,
  AccommodationLock,
  Reservation,
  Credential,
  WebhookEvent,
  AuditLog,
  AccommodationStatus,
  LockVendor,
  ReservationStatus,
  CredentialStatus,
};

/**
 * DTO para criar uma acomodação
 */
export interface CreateAccommodationDTO {
  staysAccommodationId: string;
  name: string;
  status?: AccommodationStatus;
}

/**
 * DTO para criar uma fechadura
 */
export interface CreateLockDTO {
  vendor: LockVendor;
  deviceId: string;
  alias?: string;
}

/**
 * DTO para criar um vínculo acomodação-fechadura
 */
export interface CreateAccommodationLockDTO {
  accommodationId: string;
  lockId: string;
  createdBy?: string;
}

/**
 * DTO para criar uma reserva
 */
export interface CreateReservationDTO {
  staysReservationId: string;
  accommodationId: string;
  checkInAt: Date;
  checkOutAt: Date;
  status?: ReservationStatus;
}

/**
 * DTO para criar uma credencial (PIN)
 */
export interface CreateCredentialDTO {
  reservationId: string;
  lockId: string;
  pin: string; // hash bcrypt
  plainPin?: string; // temporário
  status?: CredentialStatus;
  validFrom: Date;
  validTo: Date;
  createdBy?: string;
}

/**
 * DTO para revogar uma credencial
 */
export interface RevokeCredentialDTO {
  revokedBy: string;
  revokedAt?: Date;
}

/**
 * DTO para criar evento de webhook
 */
export interface CreateWebhookEventDTO {
  eventId: string;
  eventType: string;
  reservationId?: string;
  rawBody: Record<string, any>;
  processed?: boolean;
}

/**
 * DTO para criar log de auditoria
 */
export interface CreateAuditLogDTO {
  action: string;
  entity: string;
  entityId: string;
  userId?: string;
  details?: Record<string, any>;
}

/**
 * Resposta padrão da API
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: Date;
}

/**
 * Tipos para relatórios
 */
export interface CredentialReport {
  totalActive: number;
  totalRevoked: number;
  totalExpired: number;
  expiringToday: number;
  expiringTomorrow: number;
}

export interface ReservationReport {
  totalConfirmed: number;
  totalPending: number;
  totalCancelled: number;
  checkInToday: number;
  checkOutToday: number;
}

export interface WebhookEventReport {
  totalReceived: number;
  totalProcessed: number;
  totalFailed: number;
  lastProcessed?: Date;
  failureRate: number;
}

/**
 * Tipos para queries avançadas
 */
export interface ReservationWithCredentials extends Reservation {
  credentials: Credential[];
  accommodation: Accommodation;
}

export interface AccommodationWithLocks extends Accommodation {
  locks: AccommodationLockWithDetails[];
}

export interface AccommodationLockWithDetails extends AccommodationLock {
  lock: Lock;
}

export interface CredentialWithDetails extends Credential {
  reservation: Reservation;
  lock: Lock;
}

/**
 * Enums para facilitar uso
 */
export const AccommodationStatusOptions = {
  ACTIVE: "ACTIVE" as AccommodationStatus,
  INACTIVE: "INACTIVE" as AccommodationStatus,
};

export const LockVendorOptions = {
  TUYA: "TUYA" as LockVendor,
  OTHER: "OTHER" as LockVendor,
};

export const ReservationStatusOptions = {
  CONFIRMED: "CONFIRMED" as ReservationStatus,
  PENDING: "PENDING" as ReservationStatus,
  CANCELLED: "CANCELLED" as ReservationStatus,
  COMPLETED: "COMPLETED" as ReservationStatus,
  NO_SHOW: "NO_SHOW" as ReservationStatus,
};

export const CredentialStatusOptions = {
  ACTIVE: "ACTIVE" as CredentialStatus,
  REVOKED: "REVOKED" as CredentialStatus,
  EXPIRED: "EXPIRED" as CredentialStatus,
};
