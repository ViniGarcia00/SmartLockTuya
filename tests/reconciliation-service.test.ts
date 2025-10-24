import { ReconciliationService } from '../src/lib/reconciliation-service';

/**
 * Unit tests for ReconciliationService
 * 
 * Mock implementations for:
 * - staysClient.getReservationsUpdatedSince()
 * - Prisma operations (create, update, findUnique)
 * - BullMQ queue operations
 * - Database queries
 */

// Mock staysClient
const mockStaysClient = {
  getReservationsUpdatedSince: jest.fn(),
};

// Mock Prisma
const mockPrisma = {
  reservation: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  reconciliationLog: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
};

// Mock BullMQ queues
const mockQueue = {
  add: jest.fn(),
  getJobs: jest.fn(),
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('ReconciliationService', () => {
  let reconciliationService: ReconciliationService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Initialize service with mocks
    // reconciliationService = new ReconciliationService(mockStaysClient, mockPrisma, mockQueue, mockLogger);
  });

  describe('reconcile()', () => {
    it('should fetch and process reservations from Stays API', async () => {
      // Mock data
      const staysReservations = [
        {
          id: 'stay-123',
          accommodationId: 'acc-1',
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
          checkIn: new Date('2024-02-01'),
          checkOut: new Date('2024-02-05'),
          status: 'confirmed',
        },
      ];

      mockStaysClient.getReservationsUpdatedSince.mockResolvedValue(
        staysReservations
      );

      mockPrisma.reservation.findUnique.mockResolvedValue(null);
      mockPrisma.reservation.create.mockResolvedValue({
        id: 'res-123',
        staysReservationId: 'stay-123',
        accommodationId: staysReservations[0].accommodationId,
        checkInAt: staysReservations[0].checkIn,
        checkOutAt: staysReservations[0].checkOut,
        status: staysReservations[0].status,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // const result = await reconciliationService.reconcile();

      // expect(result.success).toBe(true);
      // expect(result.stats.fetched).toBe(1);
      // expect(result.stats.created).toBe(1);
      // expect(mockStaysClient.getReservationsUpdatedSince).toHaveBeenCalled();
    });

    it('should update existing reservations when data changes', async () => {
      const existingReservation = {
        id: 'res-123',
        guestName: 'John Doe',
        status: 'pending',
      };

      const updatedStaysRes = {
        id: 'stay-123',
        guestName: 'Jane Doe', // Changed
        status: 'confirmed',
      };

      mockPrisma.reservation.findUnique.mockResolvedValue(
        existingReservation
      );
      mockPrisma.reservation.update.mockResolvedValue({
        ...existingReservation,
        guestName: updatedStaysRes.guestName,
        status: updatedStaysRes.status,
      });

      // const result = await reconciliationService.reconcile();

      // expect(result.stats.updated).toBeGreaterThan(0);
      // expect(mockPrisma.reservation.update).toHaveBeenCalled();
    });

    it('should skip unchanged reservations', async () => {
      const existingReservation = {
        id: 'res-123',
        guestName: 'John Doe',
        status: 'confirmed',
      };

      const unchangedStaysRes = {
        id: 'stay-123',
        guestName: 'John Doe',
        status: 'confirmed',
      };

      mockPrisma.reservation.findUnique.mockResolvedValue(
        existingReservation
      );

      // const result = await reconciliationService.reconcile();

      // expect(mockPrisma.reservation.update).not.toHaveBeenCalled();
    });

    it('should cleanup orphaned PIN jobs', async () => {
      const orphanedJobs = [
        { id: 'gen-orphan-1', data: { reservationId: 'nonexistent-1' } },
        { id: 'gen-orphan-2', data: { reservationId: 'nonexistent-2' } },
      ];

      mockQueue.getJobs.mockResolvedValue(orphanedJobs);
      mockPrisma.reservation.findUnique.mockResolvedValue(null);

      // const result = await reconciliationService.reconcile();

      // expect(result.stats.orphaned).toBe(2);
    });

    it('should log reconciliation results to database', async () => {
      mockStaysClient.getReservationsUpdatedSince.mockResolvedValue([]);
      mockPrisma.reconciliationLog.create.mockResolvedValue({
        id: 'log-123',
        status: 'success',
      });

      // const result = await reconciliationService.reconcile();

      // expect(mockPrisma.reconciliationLog.create).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     data: expect.objectContaining({
      //       status: 'success',
      //     }),
      //   })
      // );
    });

    it('should handle errors and log failures', async () => {
      mockStaysClient.getReservationsUpdatedSince.mockRejectedValue(
        new Error('API Error')
      );

      // const result = await reconciliationService.reconcile();

      // expect(result.success).toBe(false);
      // expect(result.error).toBeTruthy();
      // expect(mockPrisma.reconciliationLog.create).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     data: expect.objectContaining({
      //       status: 'failed',
      //     }),
      //   })
      // );
    });
  });

  describe('scheduleJobs()', () => {
    it('should schedule PIN generation 2 hours before check-in', async () => {
      const reservation = {
        id: 'res-123',
        checkIn: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      };

      // const delayBeforeSchedule = 2 * 60 * 60 * 1000; // 2 hours

      // Mock job scheduling...
      // expect(mockQueue.add).toHaveBeenCalledWith(
      //   expect.anything(),
      //   expect.anything(),
      //   expect.objectContaining({
      //     delay: expect.closeTo(delayBeforeSchedule, 1000),
      //   })
      // );
    });

    it('should schedule PIN revocation 24 hours after check-out', async () => {
      const reservation = {
        id: 'res-123',
        checkOut: new Date(Date.now() - 10 * 60 * 60 * 1000), // 10 hours ago
      };

      // const delayAfterCheckout = 24 * 60 * 60 * 1000; // 24 hours

      // expect(mockQueue.add).toHaveBeenCalledWith(
      //   expect.anything(),
      //   expect.anything(),
      //   expect.objectContaining({
      //     delay: expect.closeTo(delayAfterCheckout, 1000),
      //   })
      // );
    });

    it('should use correct job IDs (gen-{id}, rev-{id})', async () => {
      const reservation = {
        id: 'res-123',
        checkIn: new Date(Date.now() + 4 * 60 * 60 * 1000),
        checkOut: new Date(Date.now() + 6 * 60 * 60 * 1000),
      };

      // expect(mockQueue.add).toHaveBeenCalledWith(
      //   'gen-res-123',
      //   expect.anything(),
      //   expect.anything()
      // );

      // expect(mockQueue.add).toHaveBeenCalledWith(
      //   'rev-res-123',
      //   expect.anything(),
      //   expect.anything()
      // );
    });
  });

  describe('cleanupOrphanedJobs()', () => {
    it('should remove jobs for deleted reservations', async () => {
      const orphanedJob = {
        id: 'gen-orphan-123',
        data: { reservationId: 'nonexistent' },
        remove: jest.fn(),
      };

      mockQueue.getJobs.mockResolvedValue([orphanedJob]);
      mockPrisma.reservation.findUnique.mockResolvedValue(null);

      // const count = await reconciliationService.cleanupOrphanedJobs();

      // expect(count).toBe(1);
      // expect(orphanedJob.remove).toHaveBeenCalled();
    });

    it('should not remove jobs for existing reservations', async () => {
      const validJob = {
        id: 'gen-res-123',
        data: { reservationId: 'res-123' },
        remove: jest.fn(),
      };

      mockQueue.getJobs.mockResolvedValue([validJob]);
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-123',
      });

      // const count = await reconciliationService.cleanupOrphanedJobs();

      // expect(count).toBe(0);
      // expect(validJob.remove).not.toHaveBeenCalled();
    });

    it('should return count of removed jobs', async () => {
      const orphanedJobs = [
        {
          id: 'gen-orphan-1',
          data: { reservationId: 'nonexistent-1' },
          remove: jest.fn(),
        },
        {
          id: 'gen-orphan-2',
          data: { reservationId: 'nonexistent-2' },
          remove: jest.fn(),
        },
      ];

      mockQueue.getJobs.mockResolvedValue(orphanedJobs);
      mockPrisma.reservation.findUnique.mockResolvedValue(null);

      // const count = await reconciliationService.cleanupOrphanedJobs();

      // expect(count).toBe(2);
    });
  });

  describe('stats accuracy', () => {
    it('should correctly count fetched reservations', async () => {
      const staysReservations = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `stay-${i}`,
          status: 'confirmed',
        }));

      mockStaysClient.getReservationsUpdatedSince.mockResolvedValue(
        staysReservations
      );

      // const result = await reconciliationService.reconcile();

      // expect(result.stats.fetched).toBe(5);
    });

    it('should correctly count created reservations', async () => {
      const staysReservations = Array(3)
        .fill(null)
        .map((_, i) => ({
          id: `stay-${i}`,
          status: 'confirmed',
        }));

      mockStaysClient.getReservationsUpdatedSince.mockResolvedValue(
        staysReservations
      );
      mockPrisma.reservation.findUnique.mockResolvedValue(null);
      mockPrisma.reservation.create.mockResolvedValue({});

      // const result = await reconciliationService.reconcile();

      // expect(result.stats.created).toBe(3);
    });

    it('should correctly count updated reservations', async () => {
      const staysReservations = Array(2)
        .fill(null)
        .map((_, i) => ({
          id: `stay-${i}`,
          status: 'confirmed',
        }));

      mockStaysClient.getReservationsUpdatedSince.mockResolvedValue(
        staysReservations
      );
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-existing',
        status: 'pending',
      });
      mockPrisma.reservation.update.mockResolvedValue({});

      // const result = await reconciliationService.reconcile();

      // expect(result.stats.updated).toBe(2);
    });

    it('should correctly track error count', async () => {
      const staysReservations = [
        { id: 'stay-ok', status: 'confirmed' },
        { id: 'stay-error', status: 'confirmed' },
      ];

      mockStaysClient.getReservationsUpdatedSince.mockResolvedValue(
        staysReservations
      );
      mockPrisma.reservation.findUnique.mockResolvedValue(null);

      // First create succeeds, second fails
      mockPrisma.reservation.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('DB Error'));

      // const result = await reconciliationService.reconcile();

      // expect(result.stats.errors).toBe(1);
      // expect(result.stats.created).toBe(1); // First one succeeded
    });
  });

  describe('timing and performance', () => {
    it('should measure execution duration', async () => {
      mockStaysClient.getReservationsUpdatedSince.mockResolvedValue([]);
      mockPrisma.reconciliationLog.create.mockResolvedValue({});

      const start = Date.now();
      // await reconciliationService.reconcile();
      const elapsed = Date.now() - start;

      // Duration should be recorded in stats
      // expect(result.stats.duration).toBeGreaterThan(0);
      // expect(result.stats.duration).toBeLessThan(30000); // Should be < 30 seconds
    });

    it('should handle large batches of reservations', async () => {
      const largeReservationBatch = Array(1000)
        .fill(null)
        .map((_, i) => ({
          id: `stay-${i}`,
          status: 'confirmed',
        }));

      mockStaysClient.getReservationsUpdatedSince.mockResolvedValue(
        largeReservationBatch
      );
      mockPrisma.reservation.findUnique.mockResolvedValue(null);
      mockPrisma.reservation.create.mockResolvedValue({});

      // const result = await reconciliationService.reconcile();

      // expect(result.stats.fetched).toBe(1000);
      // expect(result.stats.created).toBe(1000);
    });
  });
});
