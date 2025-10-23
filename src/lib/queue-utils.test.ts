/**
 * Queue Utils Tests
 *
 * Testes para scheduling e gerenciamento de jobs
 */

import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import {
  scheduleGeneratePin,
  scheduleRevokePin,
  cancelScheduledJobs,
  getScheduledJobStatus,
  listQueueJobs,
} from "./queue-utils";
import { generatePinQueue, revokePinQueue, redisConnection } from "./queue";

describe("Queue Utils", () => {
  const testReservationId = "test-reservation-123";
  const testLockId = "test-lock-456";
  const testPin = "$2b$10$hashedPin123456789";

  beforeAll(async () => {
    // Setup: Limpar dados anteriores
    try {
      await generatePinQueue.clean(0, 0);
      await revokePinQueue.clean(0, 0);
    } catch (error) {
      console.error("Error cleaning queues in beforeAll", error);
    }
  });

  afterAll(async () => {
    // Cleanup: Fechar conexões
    try {
      await generatePinQueue.close();
      await revokePinQueue.close();
      await redisConnection.quit();
    } catch (error) {
      console.error("Error closing queues in afterAll", error);
    }
  });

  describe("scheduleGeneratePin", () => {
    it("should schedule a generate PIN job", async () => {
      const checkInDate = new Date();
      checkInDate.setHours(checkInDate.getHours() + 2); // 2 horas no futuro

      const job = await scheduleGeneratePin(testReservationId, testLockId, testPin, checkInDate.toISOString());

      expect(job).toBeDefined();
      expect(job.id).toBe(`gen-pin-${testReservationId}`);
      expect(job.data.reservationId).toBe(testReservationId);
      expect(job.data.lockId).toBe(testLockId);
    });

    it("should schedule job with correct delay (1 hour before check-in)", async () => {
      const checkInDate = new Date(Date.now() + 3600000); // 1 hora no futuro

      const job = await scheduleGeneratePin(testReservationId, testLockId, testPin, checkInDate.toISOString());

      expect(job.delay).toBeGreaterThan(0);
      expect(job.delay).toBeLessThanOrEqual(60000); // Menos que 1 minuto (aproximadamente)
    });

    it("should allow immediate scheduling if check-in is very soon", async () => {
      const checkInDate = new Date(Date.now() + 30000); // 30 segundos no futuro

      const job = await scheduleGeneratePin(
        `${testReservationId}-immediate`,
        testLockId,
        testPin,
        checkInDate.toISOString()
      );

      expect(job).toBeDefined();
      expect(job.delay).toBeGreaterThanOrEqual(0);
    });
  });

  describe("scheduleRevokePin", () => {
    it("should schedule a revoke PIN job", async () => {
      const checkOutDate = new Date(Date.now() + 7200000); // 2 horas no futuro

      const job = await scheduleRevokePin(
        `${testReservationId}-revoke`,
        testLockId,
        checkOutDate.toISOString()
      );

      expect(job).toBeDefined();
      expect(job.id).toBe(`revoke-pin-${testReservationId}-revoke`);
      expect(job.data.reservationId).toBe(`${testReservationId}-revoke`);
    });

    it("should schedule job with correct delay (exactly at check-out)", async () => {
      const checkOutDate = new Date(Date.now() + 3600000); // 1 hora no futuro

      const job = await scheduleRevokePin(
        `${testReservationId}-revoke-2`,
        testLockId,
        checkOutDate.toISOString()
      );

      expect(job.delay).toBeGreaterThan(0);
      // Delay deve estar próximo a 1 hora (3600000 ms)
      expect(Math.abs(job.delay - 3600000)).toBeLessThan(5000); // Margem de 5 segundos
    });
  });

  describe("cancelScheduledJobs", () => {
    it("should cancel both generate and revoke jobs", async () => {
      const checkInDate = new Date(Date.now() + 7200000);
      const checkOutDate = new Date(Date.now() + 10800000);
      const reservationId = `${testReservationId}-cancel`;

      // Agendar ambos os jobs
      await scheduleGeneratePin(reservationId, testLockId, testPin, checkInDate.toISOString());
      await scheduleRevokePin(reservationId, testLockId, checkOutDate.toISOString());

      // Cancelar
      const result = await cancelScheduledJobs(reservationId);

      expect(result.generatePinCancelled).toBe(true);
      expect(result.revokePinCancelled).toBe(true);
    });

    it("should handle partial cancellation (only generate job exists)", async () => {
      const checkInDate = new Date(Date.now() + 7200000);
      const reservationId = `${testReservationId}-cancel-partial`;

      // Agendar apenas generate
      await scheduleGeneratePin(reservationId, testLockId, testPin, checkInDate.toISOString());

      // Cancelar
      const result = await cancelScheduledJobs(reservationId);

      expect(result.generatePinCancelled).toBe(true);
      expect(result.revokePinCancelled).toBe(false);
    });

    it("should return both false when no jobs exist", async () => {
      const reservationId = `${testReservationId}-no-jobs`;

      const result = await cancelScheduledJobs(reservationId);

      expect(result.generatePinCancelled).toBe(false);
      expect(result.revokePinCancelled).toBe(false);
    });
  });

  describe("getScheduledJobStatus", () => {
    it("should return null if job does not exist", async () => {
      const status = await getScheduledJobStatus(`${testReservationId}-nonexistent`, "generate");
      expect(status).toBeNull();
    });

    it("should return job status for existing generate job", async () => {
      const checkInDate = new Date(Date.now() + 7200000);
      const reservationId = `${testReservationId}-status`;

      await scheduleGeneratePin(reservationId, testLockId, testPin, checkInDate.toISOString());

      const status = await getScheduledJobStatus(reservationId, "generate");

      expect(status).toBeDefined();
      expect(status?.jobId).toBe(`gen-pin-${reservationId}`);
      expect(status?.data.reservationId).toBe(reservationId);
      expect(status?.state).toBe("delayed");
    });

    it("should return job status for existing revoke job", async () => {
      const checkOutDate = new Date(Date.now() + 7200000);
      const reservationId = `${testReservationId}-status-revoke`;

      await scheduleRevokePin(reservationId, testLockId, checkOutDate.toISOString());

      const status = await getScheduledJobStatus(reservationId, "revoke");

      expect(status).toBeDefined();
      expect(status?.jobId).toBe(`revoke-pin-${reservationId}`);
      expect(status?.state).toBe("delayed");
    });
  });

  describe("listQueueJobs", () => {
    it("should list all generate PIN queue jobs", async () => {
      // Agendar um job
      const checkInDate = new Date(Date.now() + 7200000);
      const reservationId = `${testReservationId}-list-gen`;
      await scheduleGeneratePin(reservationId, testLockId, testPin, checkInDate.toISOString());

      // Listar jobs
      const jobs = await listQueueJobs("generatePin");

      expect(jobs.waiting).toBeDefined();
      expect(Array.isArray(jobs.waiting)).toBe(true);
      expect(jobs.active).toBeDefined();
      expect(jobs.completed).toBeDefined();
      expect(jobs.failed).toBeDefined();
    });

    it("should list all revoke PIN queue jobs", async () => {
      // Agendar um job
      const checkOutDate = new Date(Date.now() + 7200000);
      const reservationId = `${testReservationId}-list-revoke`;
      await scheduleRevokePin(reservationId, testLockId, checkOutDate.toISOString());

      // Listar jobs
      const jobs = await listQueueJobs("revokePin");

      expect(jobs.waiting).toBeDefined();
      expect(Array.isArray(jobs.waiting)).toBe(true);
      expect(jobs.active).toBeDefined();
      expect(jobs.completed).toBeDefined();
      expect(jobs.failed).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid check-in date gracefully", async () => {
      const invalidDate = "invalid-date";

      await expect(scheduleGeneratePin(testReservationId, testLockId, testPin, invalidDate)).rejects.toThrow();
    });

    it("should handle missing reservationId", async () => {
      const checkInDate = new Date(Date.now() + 7200000);

      await expect(scheduleGeneratePin("", testLockId, testPin, checkInDate.toISOString())).rejects.toThrow();
    });
  });

  describe("Integration", () => {
    it("should schedule and then cancel a complete reservation cycle", async () => {
      const reservationId = `${testReservationId}-cycle`;
      const checkInDate = new Date(Date.now() + 7200000);
      const checkOutDate = new Date(Date.now() + 86400000); // 1 dia

      // 1. Agendar geração
      const genJob = await scheduleGeneratePin(reservationId, testLockId, testPin, checkInDate.toISOString());
      expect(genJob).toBeDefined();

      // 2. Agendar revogação
      const revokeJob = await scheduleRevokePin(reservationId, testLockId, checkOutDate.toISOString());
      expect(revokeJob).toBeDefined();

      // 3. Verificar status
      let genStatus = await getScheduledJobStatus(reservationId, "generate");
      expect(genStatus?.state).toBe("delayed");

      let revokeStatus = await getScheduledJobStatus(reservationId, "revoke");
      expect(revokeStatus?.state).toBe("delayed");

      // 4. Cancelar
      const cancelResult = await cancelScheduledJobs(reservationId);
      expect(cancelResult.generatePinCancelled).toBe(true);
      expect(cancelResult.revokePinCancelled).toBe(true);

      // 5. Verificar que foram removidos
      genStatus = await getScheduledJobStatus(reservationId, "generate");
      expect(genStatus).toBeNull();

      revokeStatus = await getScheduledJobStatus(reservationId, "revoke");
      expect(revokeStatus).toBeNull();
    });
  });
});
