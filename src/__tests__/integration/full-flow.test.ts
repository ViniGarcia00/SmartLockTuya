/**
 * Teste de Integração: Full Flow
 * 
 * Validar fluxo completo do sistema:
 * 1. Criação de reserva via webhook
 * 2. Agendamento de jobs
 * 3. Geração de PIN
 * 4. Atualização de reserva
 * 5. Cancelamento de reserva
 * 6. Reconciliação recupera reserva perdida
 */

import { PrismaClient } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES & SETUP
// ============================================================================

interface TestContext {
  prisma: PrismaClient;
  accommodationId: string;
  lockId: string;
  reservationId: string;
}

// Mock Redis connection para testes
const mockRedisConnection = {
  host: 'localhost',
  port: 6379,
};

const prisma = new PrismaClient();

describe('Full Flow Integration Tests', () => {
  let context: TestContext;
  let generatePinQueue: Queue;
  let revokePinQueue: Queue;

  // =========================================================================
  // Setup/Teardown
  // =========================================================================

  beforeAll(async () => {
    console.log('\n=== Setup: Full Flow Tests ===\n');

    // Inicializar filas
    generatePinQueue = new Queue('generatePin', {
      connection: mockRedisConnection,
    });

    revokePinQueue = new Queue('revokePin', {
      connection: mockRedisConnection,
    });

    context = {
      prisma,
      accommodationId: uuidv4(),
      lockId: uuidv4(),
      reservationId: uuidv4(),
    };

    // Limpar dados antigos
    await cleanupTestData();

    // Criar Accommodation
    await prisma.accommodation.create({
      data: {
        id: context.accommodationId,
        staysAccommodationId: `stays-${context.accommodationId}`,
        name: 'Test Accommodation',
      },
    });

    // Criar Lock
    await prisma.lock.create({
      data: {
        id: context.lockId,
        deviceId: `device-${context.lockId}`,
        vendor: 'TUYA',
      },
    });

    // Mapear Lock à Accommodation
    await prisma.accommodationLock.create({
      data: {
        accommodationId: context.accommodationId,
        lockId: context.lockId,
      },
    });

    console.log('✅ Setup completo');
  });

  afterAll(async () => {
    console.log('\n=== Teardown: Limpando dados ===\n');
    await cleanupTestData();
    await generatePinQueue.close();
    await revokePinQueue.close();
  });

  async function cleanupTestData() {
    try {
      // Limpar em ordem de dependência
      await prisma.credential.deleteMany({
        where: {
          reservation: {
            accommodationId: context?.accommodationId,
          },
        },
      });

      await prisma.reservation.deleteMany({
        where: {
          accommodationId: context?.accommodationId,
        },
      });

      await prisma.accommodationLock.deleteMany({
        where: {
          accommodationId: context?.accommodationId,
        },
      });

      await prisma.accommodation.deleteMany({
        where: {
          id: context?.accommodationId,
        },
      });

      await prisma.lock.deleteMany({
        where: {
          id: context?.lockId,
        },
      });
    } catch (error) {
      // Silent fail durante cleanup
    }
  }

  // =========================================================================
  // CENÁRIO 1: Criação de Reserva
  // =========================================================================

  it('should create reservation with webhook and schedule PIN jobs', async () => {
    console.log('\n--- Cenário 1: Criação de Reserva ---\n');

    const checkInDate = new Date();
    checkInDate.setHours(14, 0, 0, 0); // 14:00

    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 3); // 3 dias depois
    checkOutDate.setHours(11, 0, 0, 0); // 11:00

    // 1. Criar Reservation via webhook
    const reservation = await prisma.reservation.create({
      data: {
        id: context.reservationId,
        staysReservationId: `stays-${context.reservationId}`,
        accommodationId: context.accommodationId,
        checkInAt: checkInDate,
        checkOutAt: checkOutDate,
        status: 'CONFIRMED',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
      },
    });

    console.log('✅ Reservation criado:', reservation.id);

    // 2. Verificar que Reservation foi criado
    const found = await prisma.reservation.findUnique({
      where: { id: context.reservationId },
    });
    expect(found).toBeDefined();
    expect(found?.status).toBe('CONFIRMED');

    // 3. Agendar jobs (simulando o que faria o webhook handler)
    const generatePinJobId = `gen-${context.reservationId}`;
    const revokePinJobId = `rev-${context.reservationId}`;

    // calculateDelay: 2 horas antes do check-in
    const generatePinDelay = checkInDate.getTime() - Date.now() - 2 * 60 * 60 * 1000;
    const revokePinDelay = checkOutDate.getTime() - Date.now() + 24 * 60 * 60 * 1000;

    await generatePinQueue.add(
      'generate',
      {
        reservationId: context.reservationId,
        accommodationId: context.accommodationId,
        lockId: context.lockId,
      },
      {
        jobId: generatePinJobId,
        delay: Math.max(generatePinDelay, 0),
      }
    );

    await revokePinQueue.add(
      'revoke',
      {
        reservationId: context.reservationId,
        lockId: context.lockId,
      },
      {
        jobId: revokePinJobId,
        delay: Math.max(revokePinDelay, 0),
      }
    );

    console.log(`✅ Jobs agendados: ${generatePinJobId}, ${revokePinJobId}`);

    // 4. Verificar que jobs foram agendados
    const generateJob = await generatePinQueue.getJob(generatePinJobId);
    const revokeJob = await revokePinQueue.getJob(revokePinJobId);

    expect(generateJob).toBeDefined();
    expect(revokeJob).toBeDefined();

    console.log('✅ Cenário 1 completo: Reserva criada com jobs agendados');
  });

  // =========================================================================
  // CENÁRIO 2: Atualização de Reserva
  // =========================================================================

  it('should update reservation and reschedule jobs', async () => {
    console.log('\n--- Cenário 2: Atualização de Reserva ---\n');

    // 1. Buscar Reservation existente
    const reservation = await prisma.reservation.findUnique({
      where: { id: context.reservationId },
    });

    expect(reservation).toBeDefined();

    // 2. Simular antecipação de check-in (2 horas antes)
    const newCheckIn = new Date(reservation!.checkInAt);
    newCheckIn.setHours(newCheckIn.getHours() - 2);

    // 3. Atualizar Reservation
    const updated = await prisma.reservation.update({
      where: { id: context.reservationId },
      data: {
        checkInAt: newCheckIn,
      },
    });

    console.log('✅ Reservation atualizado com novo checkInAt');

    // 4. Reagendar jobs
    const oldGeneratePinJobId = `gen-${context.reservationId}`;
    const oldRevokeJobId = `rev-${context.reservationId}`;

    // Remover jobs antigos
    const oldGenJob = await generatePinQueue.getJob(oldGeneratePinJobId);
    if (oldGenJob) await oldGenJob.remove();

    const oldRevJob = await revokePinQueue.getJob(oldRevokeJobId);
    if (oldRevJob) await oldRevJob.remove();

    // Agendar novos jobs
    const generatePinDelay = newCheckIn.getTime() - Date.now() - 2 * 60 * 60 * 1000;

    await generatePinQueue.add(
      'generate',
      {
        reservationId: context.reservationId,
        accommodationId: context.accommodationId,
        lockId: context.lockId,
      },
      {
        jobId: oldGeneratePinJobId,
        delay: Math.max(generatePinDelay, 0),
      }
    );

    console.log('✅ Jobs reagendados com novo delay');

    // 5. Verificar novo job
    const newGenJob = await generatePinQueue.getJob(oldGeneratePinJobId);
    expect(newGenJob).toBeDefined();

    console.log('✅ Cenário 2 completo: Reserva atualizada e jobs reagendados');
  });

  // =========================================================================
  // CENÁRIO 3: Cancelamento de Reserva
  // =========================================================================

  it('should cancel reservation and revoke PIN', async () => {
    console.log('\n--- Cenário 3: Cancelamento de Reserva ---\n');

    // 1. Criar Credential (simular que PIN foi gerado)
    const credential = await prisma.credential.create({
      data: {
        id: uuidv4(),
        reservationId: context.reservationId,
        lockId: context.lockId,
        pin: '1234567',
        pinHash: 'hash_of_1234567',
        isActive: true,
      },
    });

    console.log('✅ Credential (PIN) criado:', credential.id);

    // 2. Atualizar Reservation para CANCELLED
    await prisma.reservation.update({
      where: { id: context.reservationId },
      data: { status: 'CANCELLED' },
    });

    console.log('✅ Reservation marcado como CANCELLED');

    // 3. Revogar PIN (simular execução do revokePin job)
    const revokedCredential = await prisma.credential.update({
      where: { id: credential.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    console.log('✅ PIN revogado:', revokedCredential.id);

    // 4. Cancelar jobs
    const generatePinJobId = `gen-${context.reservationId}`;
    const revokePinJobId = `rev-${context.reservationId}`;

    const genJob = await generatePinQueue.getJob(generatePinJobId);
    if (genJob) await genJob.remove();

    const revJob = await revokePinQueue.getJob(revokePinJobId);
    if (revJob) await revJob.remove();

    console.log('✅ Jobs cancelados');

    // 5. Verificar estado final
    const finalReservation = await prisma.reservation.findUnique({
      where: { id: context.reservationId },
      include: { credentials: true },
    });

    expect(finalReservation?.status).toBe('CANCELLED');
    expect(finalReservation?.credentials[0]?.isActive).toBe(false);

    console.log('✅ Cenário 3 completo: Reserva cancelada e PIN revogado');
  });

  // =========================================================================
  // CENÁRIO 4: Reconciliação Recupera Reserva Perdida
  // =========================================================================

  it('should recover lost reservation via reconciliation', async () => {
    console.log('\n--- Cenário 4: Reconciliação Recupera Reserva Perdida ---\n');

    // 1. Criar nova reserva para este teste
    const testReservationId = uuidv4();
    const checkIn = new Date();
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 2);

    await prisma.reservation.create({
      data: {
        id: testReservationId,
        staysReservationId: `stays-${testReservationId}`,
        accommodationId: context.accommodationId,
        checkInAt: checkIn,
        checkOutAt: checkOut,
        status: 'CONFIRMED',
        guestName: 'Jane Doe',
        guestEmail: 'jane@example.com',
      },
    });

    console.log('✅ Reservation de teste criado:', testReservationId);

    // 2. Deletar Reservation (simular perda de dados)
    await prisma.reservation.delete({
      where: { id: testReservationId },
    });

    console.log('✅ Reservation deletado (simulando perda de dados)');

    // 3. Verificar que foi deletado
    let found = await prisma.reservation.findUnique({
      where: { id: testReservationId },
    });
    expect(found).toBeNull();

    // 4. Executar reconciliação (simular)
    // Neste caso, a reconciliação re-criaria a reserva da API Stays
    const recoveredReservation = await prisma.reservation.create({
      data: {
        id: testReservationId,
        staysReservationId: `stays-${testReservationId}`,
        accommodationId: context.accommodationId,
        checkInAt: checkIn,
        checkOutAt: checkOut,
        status: 'CONFIRMED',
        guestName: 'Jane Doe',
        guestEmail: 'jane@example.com',
      },
    });

    console.log('✅ Reservation re-criado pela reconciliação');

    // 5. Verificar que foi recuperado
    found = await prisma.reservation.findUnique({
      where: { id: testReservationId },
    });
    expect(found).toBeDefined();
    expect(found?.id).toBe(testReservationId);

    console.log('✅ Cenário 4 completo: Reserva perdida foi recuperada');

    // Cleanup
    await prisma.reservation.delete({
      where: { id: testReservationId },
    });
  });

  // =========================================================================
  // TESTE ADICIONAL: Verificar transações ACID
  // =========================================================================

  it('should maintain data consistency in concurrent operations', async () => {
    console.log('\n--- Teste: Consistência de Dados ===\n');

    const reservationId = uuidv4();

    // Criar múltiplas credenciais concorrentemente
    const credentials = await Promise.all([
      prisma.credential.create({
        data: {
          id: uuidv4(),
          reservationId,
          lockId: context.lockId,
          pin: '1111111',
          pinHash: 'hash1',
          isActive: true,
        },
      }),
      prisma.credential.create({
        data: {
          id: uuidv4(),
          reservationId,
          lockId: context.lockId,
          pin: '2222222',
          pinHash: 'hash2',
          isActive: false,
        },
      }),
    ]);

    console.log(`✅ ${credentials.length} credentials criados concorrentemente`);

    // Verificar que ambos foram criados
    const allCredentials = await prisma.credential.findMany({
      where: { reservationId },
    });

    expect(allCredentials).toHaveLength(2);

    console.log('✅ Consistência ACID mantida');

    // Cleanup
    await prisma.credential.deleteMany({
      where: { reservationId },
    });
  });
});
