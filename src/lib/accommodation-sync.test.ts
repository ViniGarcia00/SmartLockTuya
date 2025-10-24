import { syncAccommodations, AccommodationSyncResult, IStaysClient } from './accommodation-sync';
import { PrismaClient } from '@prisma/client';

// ======================================================================
// Mock Stays Client
// ======================================================================
const createMockStaysClient = (accommodations: Array<{ id: string; name: string }> = []): IStaysClient => ({
  listAccommodations: jest.fn().mockResolvedValue(accommodations),
});

// ======================================================================
// Mock Prisma
// ======================================================================
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    accommodation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  })),
}));

// ======================================================================
// Test Suite
// ======================================================================
describe('syncAccommodations', () => {
  let mockPrisma: any;
  let mockStaysClient: IStaysClient;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    mockStaysClient = createMockStaysClient();
    
    // Always mock findMany to return empty array by default (no accommodations to inactivate)
    mockPrisma.accommodation.findMany.mockResolvedValue([]);
    
    jest.clearAllMocks();
  });

  // ====================================================================
  // Test 1: Create new accommodations from API
  // ====================================================================
  it('should create new accommodations from API', async () => {
    const apiAccommodations = [
      { id: 'ACC-001', name: 'Suite Master' },
      { id: 'ACC-002', name: 'Suite Deluxe' },
    ];

    mockStaysClient = createMockStaysClient(apiAccommodations);

    mockPrisma.accommodation.findUnique.mockResolvedValue(null);
    mockPrisma.accommodation.create.mockImplementation((args: any) => ({
      id: `sync-${Date.now()}`,
      ...args.data,
    }));

    const result = await syncAccommodations(mockStaysClient, mockPrisma, 'test-req-1');

    expect(result.success).toBe(true);
    expect(result.created).toBe(2);
    expect(mockPrisma.accommodation.create).toHaveBeenCalledTimes(2);
  });

  // ====================================================================
  // Test 2: Skip accommodations with missing IDs
  // ====================================================================
  it('should skip accommodations with missing IDs', async () => {
    const apiAccommodations = [
      { id: '', name: 'Invalid' }, // Missing ID
      { id: 'ACC-001', name: 'Valid' },
    ];

    mockStaysClient = createMockStaysClient(apiAccommodations);
    mockPrisma.accommodation.findUnique.mockResolvedValue(null);
    mockPrisma.accommodation.create.mockImplementation((args: any) => ({
      id: `sync-${Date.now()}`,
      ...args.data,
    }));

    const result = await syncAccommodations(mockStaysClient, mockPrisma, 'test-req-2');

    expect(result.created).toBe(1); // Only 1 created
    expect(result.errors.length).toBe(1); // 1 error for empty ID
  });

  // ====================================================================
  // Test 3: Update when name changes
  // ====================================================================
  it('should update when name changes', async () => {
    const apiAccommodations = [
      { id: 'ACC-001', name: 'Suite Master - Updated' },
    ];

    mockStaysClient = createMockStaysClient(apiAccommodations);

    mockPrisma.accommodation.findUnique.mockResolvedValue({
      id: 'sync-123',
      staysAccommodationId: 'ACC-001',
      name: 'Suite Master',
      status: 'ACTIVE',
    });

    mockPrisma.accommodation.update.mockResolvedValue({
      id: 'sync-123',
      staysAccommodationId: 'ACC-001',
      name: 'Suite Master - Updated',
      status: 'ACTIVE',
    });

    const result = await syncAccommodations(mockStaysClient, mockPrisma, 'test-req-3');

    expect(result.updated).toBe(1);
    expect(mockPrisma.accommodation.update).toHaveBeenCalled();
  });

  // ====================================================================
  // Test 4: Ignore unchanged accommodations
  // ====================================================================
  it('should ignore unchanged accommodations', async () => {
    const apiAccommodations = [
      { id: 'ACC-001', name: 'Suite Master' },
    ];

    mockStaysClient = createMockStaysClient(apiAccommodations);

    mockPrisma.accommodation.findUnique.mockResolvedValue({
      id: 'sync-123',
      staysAccommodationId: 'ACC-001',
      name: 'Suite Master',
      status: 'ACTIVE',
    });

    const result = await syncAccommodations(mockStaysClient, mockPrisma, 'test-req-4');

    expect(result.updated).toBe(0);
    expect(mockPrisma.accommodation.update).not.toHaveBeenCalled();
  });

  // ====================================================================
  // Test 5: Inactivate accommodations removed from API
  // ====================================================================
  it('should inactivate accommodations removed from API', async () => {
    const apiAccommodations: Array<{ id: string; name: string }> = []; // Empty API

    mockStaysClient = createMockStaysClient(apiAccommodations);

    mockPrisma.accommodation.findMany.mockResolvedValue([
      {
        id: 'sync-123',
        staysAccommodationId: 'ACC-001',
        name: 'Suite Master',
        status: 'ACTIVE',
      },
    ]);

    mockPrisma.accommodation.update.mockResolvedValue({
      id: 'sync-123',
      staysAccommodationId: 'ACC-001',
      name: 'Suite Master',
      status: 'INACTIVE',
    });

    const result = await syncAccommodations(mockStaysClient, mockPrisma, 'test-req-5');

    expect(result.inactivated).toBe(1);
  });

  // ====================================================================
  // Test 6: Handle API failure gracefully
  // ====================================================================
  it('should handle API failure gracefully', async () => {
    const apiError = new Error('API Connection Error');

    mockStaysClient = {
      listAccommodations: jest.fn().mockRejectedValue(apiError),
    };

    const result = await syncAccommodations(mockStaysClient, mockPrisma, 'test-req-6');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // ====================================================================
  // Test 7: Continue on individual accommodation errors
  // ====================================================================
  it('should continue processing on individual accommodation errors', async () => {
    const apiAccommodations = [
      { id: 'ACC-001', name: 'Suite Master' },
      { id: 'ACC-002', name: 'Suite Deluxe' },
    ];

    mockStaysClient = createMockStaysClient(apiAccommodations);

    // First call returns null (not found), second throws error
    mockPrisma.accommodation.findUnique
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('DB Error'));

    mockPrisma.accommodation.create.mockResolvedValue({
      id: `sync-${Date.now()}`,
      staysAccommodationId: 'ACC-001',
      name: 'Suite Master',
      status: 'ACTIVE',
    });

    const result = await syncAccommodations(mockStaysClient, mockPrisma, 'test-req-7');

    expect(result.created).toBe(1); // Only 1 created
    expect(result.errors.length).toBe(1); // 1 error logged
  });

  // ====================================================================
  // Test 8: Include ISO timestamps in results
  // ====================================================================
  it('should include ISO timestamps in results', async () => {
    mockStaysClient = createMockStaysClient([]);

    const result = await syncAccommodations(mockStaysClient, mockPrisma, 'test-req-8');

    expect(result.details).toBeDefined();
    expect(result.details?.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    expect(result.details?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    expect(result.details?.duration).toBeGreaterThanOrEqual(0);
  });

  // ====================================================================
  // Test 9: Full sync cycle (create + update + inactivate)
  // ====================================================================
  it('should handle full sync cycle', async () => {
    const apiAccommodations = [
      { id: 'ACC-001', name: 'Suite Master - Updated' }, // Update
      { id: 'ACC-002', name: 'Suite Deluxe' }, // Create
    ];

    mockStaysClient = createMockStaysClient(apiAccommodations);

    // ACC-001 exists and needs update
    // ACC-002 doesn't exist, needs create
    // ACC-003 exists but removed from API, needs inactivate
    mockPrisma.accommodation.findUnique
      .mockResolvedValueOnce({
        id: 'sync-123',
        staysAccommodationId: 'ACC-001',
        name: 'Suite Master',
        status: 'ACTIVE',
      })
      .mockResolvedValueOnce(null); // ACC-002 not found

    mockPrisma.accommodation.findMany.mockResolvedValue([
      {
        id: 'sync-456',
        staysAccommodationId: 'ACC-003',
        name: 'Suite Standard',
        status: 'ACTIVE',
      },
    ]);

    mockPrisma.accommodation.create.mockResolvedValue({
      id: 'sync-789',
      staysAccommodationId: 'ACC-002',
      name: 'Suite Deluxe',
      status: 'ACTIVE',
    });

    mockPrisma.accommodation.update.mockResolvedValue({
      id: 'sync-123',
      staysAccommodationId: 'ACC-001',
      name: 'Suite Master - Updated',
      status: 'ACTIVE',
    });

    const result = await syncAccommodations(mockStaysClient, mockPrisma, 'test-req-9');

    expect(result.success).toBe(true);
    expect(result.created).toBeGreaterThanOrEqual(1);
    expect(result.updated).toBeGreaterThanOrEqual(1);
    expect(result.inactivated).toBeGreaterThanOrEqual(1);
  });

  // ====================================================================
  // Test 10: Proper result structure
  // ====================================================================
  it('should have proper result structure with all fields', async () => {
    const requestId = 'test-req-10-unique-id';

    mockStaysClient = createMockStaysClient([]);

    const result = await syncAccommodations(mockStaysClient, mockPrisma, requestId);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('created');
    expect(result).toHaveProperty('updated');
    expect(result).toHaveProperty('inactivated');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('details');
  });
});
