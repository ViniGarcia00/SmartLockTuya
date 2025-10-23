/**
 * Tipos e Interfaces Prisma para SmartLock Tuya
 * 
 * Arquivo auxiliar para tipagem completa de operações com banco de dados
 * 
 * ⚠️ NOTA: Os tipos Prisma são gerados automaticamente pelo Prisma CLI
 * Se faltarem tipos, execute: npx prisma generate
 */

// Importar tipos gerados pelo Prisma
import type { PrismaClient } from "@prisma/client";

// Re-exportar Prisma Client para facilitar importações
export type { PrismaClient };

/**
 * DTO para criar uma acomodação
 */
export interface CreateAccommodationDTO {
  staysAccommodationId: string;
  name: string;
}

/**
 * DTO para criar uma fechadura
 */
export interface CreateLockDTO {
  vendor: string;
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
}

/**
 * DTO para criar uma credencial (PIN)
 */
export interface CreateCredentialDTO {
  reservationId: string;
  lockId: string;
  pin: string; // hash bcrypt
  plainPin?: string; // temporário
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
 * Enums customizados para tipos comuns
 */
export enum AccommodationStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum LockVendor {
  TUYA = "TUYA",
  AUGUST = "AUGUST",
  YALE = "YALE",
  OTHER = "OTHER",
}

export enum ReservationStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
  NO_SHOW = "NO_SHOW",
}

export enum CredentialStatus {
  ACTIVE = "ACTIVE",
  REVOKED = "REVOKED",
  EXPIRED = "EXPIRED",
}

/**
 * Tipos para queries avançadas
 */
export interface ReservationWithCredentials {
  id: string;
  staysReservationId: string;
  accommodationId: string;
  checkInAt: Date;
  checkOutAt: Date;
  status: ReservationStatus;
  credentials: Array<{ id: string; pin: string; validFrom: Date; validTo: Date }>;
  accommodation: { id: string; name: string };
}

export interface AccommodationWithLocks {
  id: string;
  staysAccommodationId: string;
  name: string;
  status: AccommodationStatus;
  locks: Array<{ lockId: string; lock: { id: string; deviceId: string; vendor: LockVendor } }>;
}

export interface AccommodationLockWithDetails {
  id: string;
  accommodationId: string;
  lockId: string;
  lock: { id: string; deviceId: string; vendor: LockVendor };
}

export interface CredentialWithDetails {
  id: string;
  reservationId: string;
  lockId: string;
  pin: string;
  validFrom: Date;
  validTo: Date;
  status: CredentialStatus;
  reservation: { id: string; staysReservationId: string };
  lock: { id: string; deviceId: string; vendor: LockVendor };
}

/**
 * Enum options para facilitar uso
 */
export const AccommodationStatusOptions = {
  ACTIVE: AccommodationStatus.ACTIVE,
  INACTIVE: AccommodationStatus.INACTIVE,
} as const;

export const LockVendorOptions = {
  TUYA: LockVendor.TUYA,
  AUGUST: LockVendor.AUGUST,
  YALE: LockVendor.YALE,
  OTHER: LockVendor.OTHER,
} as const;

export const ReservationStatusOptions = {
  PENDING: ReservationStatus.PENDING,
  CONFIRMED: ReservationStatus.CONFIRMED,
  CANCELLED: ReservationStatus.CANCELLED,
  COMPLETED: ReservationStatus.COMPLETED,
  NO_SHOW: ReservationStatus.NO_SHOW,
} as const;

export const CredentialStatusOptions = {
  ACTIVE: CredentialStatus.ACTIVE,
  REVOKED: CredentialStatus.REVOKED,
  EXPIRED: CredentialStatus.EXPIRED,
} as const;
