/**
 * Teste de Integração: Revoke PIN Job
 *
 * Validar fluxo completo:
 * 1. Setup: cria Reservation, Lock, Credential com status ACTIVE
 * 2. Executa job processRevokePin
 * 3. Verifica Credential marcado como REVOKED
 * 4. Verifica lock provider foi chamado com revokePin
 * 5. Testa idempotência (segunda chamada não falha)
 * 6. Testa erro do lock provider (continua processando outras)
 */

import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
  processRevokePin,
  RevokePinJobData,
  RevokePinJobResult,
} from './revoke-pin.job';
import { LockProviderFactory } from '../lib/lock-provider-factory';
import { MockLockProvider } from '../lib/mock-lock-provider';

// Setup de tipos para testes
const prisma = new PrismaClient();

describe('Revoke PIN - Integration Tests', () => {
  // =========================================================================
  // Dados de teste
  // =========================================================================
  const testAccommodationId = 'test-accommodation-revoke-001';
  const testLockId = 'test-lock-revoke-001';
  const testReservationId = 'test-reservation-revoke-001';
  const testRequestId = 'test-request-revoke-001';

  // =========================================================================
  // Setup/Teardown
  // =========================================================================
  beforeAll(async () => {
    console.log('\n=== Setup: Preparando dados de teste ===\n');

    // Limpar dados antigos (se existirem)
    try {
      await prisma.credential.deleteMany({
        where: {
          reservationId: testReservationId,
        },
      });

      await prisma.accommodationLock.deleteMany({
        where: {
          accommodationId: testAccommodationId,
        },
      });

      await prisma.reservation.deleteMany({
        where: {
          id: testReservationId,
        },
      });

      await prisma.lock.deleteMany({
        where: {
          id: testLockId,
        },
      });

      await prisma.accommodation.deleteMany({
        where: {
          id: testAccommodationId,
        },
      });

      console.log('✅ Limpeza de dados antigos concluída');
    } catch (error) {
      console.warn(
        '⚠️ Erro durante limpeza (pode ser normal se dados não existem):',
        error
      );
    }

    // Criar Accommodation
    await prisma.accommodation.create({
      data: {
        id: testAccommodationId,
        staysAccommodationId: `stays-${testAccommodationId}`,
        name: 'Test Accommodation Revoke',
      },
    });
    console.log('✅ Accommodation criado');

    // Criar Lock
    await prisma.lock.create({
      data: {
        id: testLockId,
        deviceId: `device-${testLockId}`,
        vendor: 'TUYA',
      },
    });
    console.log('✅ Lock criado');

    // Mapear Lock à Accommodation
    await prisma.accommodationLock.create({
      data: {
        accommodationId: testAccommodationId,
        lockId: testLockId,
      },
    });
    console.log('✅ AccommodationLock criado');

    // Criar Reservation
    const checkInDate = new Date();
    const checkOutDate = new Date();
    checkOutDate.setDate(checkOutDate.getDate() + 3); // 3 dias após check-in

    await prisma.reservation.create({
      data: {
        id: testReservationId,
        staysReservationId: `stays-${testReservationId}`,
        accommodationId: testAccommodationId,
        checkInAt: checkInDate,
        checkOutAt: checkOutDate,
        status: 'CONFIRMED',
      },
    });
    console.log('✅ Reservation criado');
    console.log('');
  });

  afterAll(async () => {
    console.log('\n=== Teardown: Limpando dados de teste ===\n');

    // Limpar dados criados nos testes
    try {
      await prisma.credential.deleteMany({
        where: {
          reservationId: testReservationId,
        },
      });

      await prisma.auditLog.deleteMany({
        where: {
          entityId: {
            in: [testReservationId, testLockId, testAccommodationId],
          },
        },
      });

      await prisma.accommodationLock.deleteMany({
        where: {
          accommodationId: testAccommodationId,
        },
      });

      await prisma.reservation.deleteMany({
        where: {
          id: testReservationId,
        },
      });

      await prisma.lock.deleteMany({
        where: {
          id: testLockId,
        },
      });

      await prisma.accommodation.deleteMany({
        where: {
          id: testAccommodationId,
        },
      });

      console.log('✅ Limpeza concluída');
    } catch (error) {
      console.error('❌ Erro durante limpeza final:', error);
    }

    LockProviderFactory.reset();
    await prisma.$disconnect();
    console.log('');
  });

  // =========================================================================
  // Testes
  // =========================================================================

  describe('Fluxo Completo de Revogação', () => {
    it('deve revogar credential e atualizar status para REVOKED', async () => {
      // Criar credential com status ACTIVE
      const credential = await prisma.credential.create({
        data: {
          lockId: testLockId,
          reservationId: testReservationId,
          pin: '123456',
          pinHash:
            '$2b$10$test.hashedpin.abcdefghijklmnopqrstuvwxyz12345678', // bcrypt hash fake
          status: 'ACTIVE',
          providerRef: 'provider-ref-123',
        },
      });

      console.log(`\nTestando revogação de credential: ${credential.id}`);

      // Mock LockProviderFactory
      const mockProvider = new MockLockProvider();
      const revokeSpySpy = jest.spyOn(mockProvider, 'revokePin');

      LockProviderFactory.setProvider(mockProvider);

      // Dados do job
      const jobData: RevokePinJobData = {
        reservationId: testReservationId,
      };

      // Mock do Job
      const mockJob = {
        id: 'job-revoke-123',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<RevokePinJobData>;

      // Executar job
      const result: RevokePinJobResult = await processRevokePin(mockJob);

      // ===================================================================
      // Asserts
      // ===================================================================
      expect(result.success).toBe(true);
      expect(result.revokedCredentials).toBe(1);
      expect(result.credentialIds).toContain(credential.id);
      expect(revokeSpySpy).toHaveBeenCalledWith(
        testLockId,
        'provider-ref-123'
      );

      // Verificar que credential foi marcado como REVOKED
      const updatedCredential = await prisma.credential.findUnique({
        where: { id: credential.id },
      });

      expect(updatedCredential?.status).toBe('REVOKED');
      expect(updatedCredential?.revokedAt).not.toBeNull();
      expect(updatedCredential?.revokedBy).toBe('system-pin-revoke');

      // Verificar audit log foi criado
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'REVOKE_CREDENTIAL',
          entityId: testReservationId,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const lastLog = auditLogs[auditLogs.length - 1];
      expect((lastLog.details as any).revokedCount).toBe(1);

      console.log('✅ Credential revogado com sucesso');
      console.log(`  - Status atualizado: ${updatedCredential?.status}`);
      console.log(`  - Audit log criado: ${lastLog.id}`);
    });

    it('deve revogar múltiplos credentials de uma reserva', async () => {
      // Criar múltiplos credentials com status ACTIVE
      const credentials = await Promise.all([
        prisma.credential.create({
          data: {
            lockId: testLockId,
            reservationId: testReservationId,
            pin: '111111',
            pinHash: '$2b$10$test.hashedpin1',
            status: 'ACTIVE',
            providerRef: 'provider-ref-1',
          },
        }),
        prisma.credential.create({
          data: {
            lockId: testLockId,
            reservationId: testReservationId,
            pin: '222222',
            pinHash: '$2b$10$test.hashedpin2',
            status: 'ACTIVE',
            providerRef: 'provider-ref-2',
          },
        }),
      ]);

      console.log(`\nTestando revogação de ${credentials.length} credentials`);

      // Mock LockProviderFactory
      const mockProvider = new MockLockProvider();
      LockProviderFactory.setProvider(mockProvider);

      // Dados do job
      const jobData: RevokePinJobData = {
        reservationId: testReservationId,
      };

      // Mock do Job
      const mockJob = {
        id: 'job-revoke-multi-123',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<RevokePinJobData>;

      // Executar job
      const result: RevokePinJobResult = await processRevokePin(mockJob);

      // ===================================================================
      // Asserts
      // ===================================================================
      expect(result.success).toBe(true);
      expect(result.revokedCredentials).toBe(2);
      expect(result.credentialIds?.length).toBe(2);

      // Verificar que todos os credentials foram marcados como REVOKED
      for (const cred of credentials) {
        const updated = await prisma.credential.findUnique({
          where: { id: cred.id },
        });
        expect(updated?.status).toBe('REVOKED');
      }

      console.log('✅ Múltiplos credentials revogados com sucesso');
    });
  });

  describe('Idempotência', () => {
    it('deve retornar sucesso na segunda chamada (idempotente)', async () => {
      // Criar credential já REVOKED
      const credential = await prisma.credential.create({
        data: {
          lockId: testLockId,
          reservationId: testReservationId,
          pin: '333333',
          pinHash: '$2b$10$test.hashedpin3',
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedBy: 'test',
          providerRef: 'provider-ref-revoked',
        },
      });

      console.log(
        `\nTestando idempotência com credential já revogado: ${credential.id}`
      );

      // Mock LockProviderFactory
      const mockProvider = new MockLockProvider();
      LockProviderFactory.setProvider(mockProvider);

      // Dados do job
      const jobData: RevokePinJobData = {
        reservationId: testReservationId,
      };

      // Mock do Job
      const mockJob = {
        id: 'job-revoke-idempotent-123',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<RevokePinJobData>;

      // Executar job (não deve falhar)
      const result: RevokePinJobResult = await processRevokePin(mockJob);

      // ===================================================================
      // Asserts
      // ===================================================================
      // Deve retornar sucesso mesmo sem credentials ativos para revogar
      expect(result.success).toBe(true);
      expect(result.revokedCredentials).toBe(0);

      console.log('✅ Job idempotente - retorna sucesso sem erro');
    });

    it('deve retornar sucesso quando nenhuma credential ativa existe', async () => {
      // Não criar credentials, apenas chamar job
      console.log('\nTestando revogação com nenhuma credential ativa');

      // Mock LockProviderFactory
      const mockProvider = new MockLockProvider();
      LockProviderFactory.setProvider(mockProvider);

      // Dados do job
      const jobData: RevokePinJobData = {
        reservationId: testReservationId,
      };

      // Mock do Job
      const mockJob = {
        id: 'job-revoke-empty-123',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<RevokePinJobData>;

      // Executar job (deve retornar sucesso)
      const result: RevokePinJobResult = await processRevokePin(mockJob);

      // ===================================================================
      // Asserts
      // ===================================================================
      expect(result.success).toBe(true);
      expect(result.revokedCredentials).toBe(0);
      expect(result.credentialIds?.length).toBe(0);

      console.log('✅ Job retorna sucesso quando não há credentials ativos');
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve retornar erro quando reservation não existe', async () => {
      console.log('\nTestando erro - Reservation não existe');

      // Mock LockProviderFactory
      const mockProvider = new MockLockProvider();
      LockProviderFactory.setProvider(mockProvider);

      // Dados do job com reservation ID inválido
      const jobData: RevokePinJobData = {
        reservationId: 'non-existent-reservation-id',
      };

      // Mock do Job
      const mockJob = {
        id: 'job-revoke-invalid-123',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<RevokePinJobData>;

      // Executar job
      const result: RevokePinJobResult = await processRevokePin(mockJob);

      // ===================================================================
      // Asserts
      // ===================================================================
      expect(result.success).toBe(false);
      expect(result.error).toContain('Reservation not found');

      // Verificar audit log de erro foi criado
      const errorLogs = await prisma.auditLog.findMany({
        where: {
          action: 'REVOKE_CREDENTIAL_ERROR',
        },
      });

      expect(errorLogs.length).toBeGreaterThan(0);

      console.log('✅ Erro tratado corretamente');
    });

    it('deve retornar erro quando reservation ID está vazio', async () => {
      console.log('\nTestando erro - Reservation ID vazio');

      // Mock LockProviderFactory
      const mockProvider = new MockLockProvider();
      LockProviderFactory.setProvider(mockProvider);

      // Dados do job inválidos
      const jobData = {
        reservationId: '',
      } as unknown as RevokePinJobData;

      // Mock do Job
      const mockJob = {
        id: 'job-revoke-empty-id-123',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<RevokePinJobData>;

      // Executar job
      const result: RevokePinJobResult = await processRevokePin(mockJob);

      // ===================================================================
      // Asserts
      // ===================================================================
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required');

      console.log('✅ Validação de entrada funcionando');
    });

    it('deve continuar processando se lock provider falhar para um credential', async () => {
      // Criar 2 credentials
      const cred1 = await prisma.credential.create({
        data: {
          lockId: testLockId,
          reservationId: testReservationId,
          pin: '444444',
          pinHash: '$2b$10$test.hashedpin4',
          status: 'ACTIVE',
          providerRef: 'provider-ref-will-fail',
        },
      });

      const cred2 = await prisma.credential.create({
        data: {
          lockId: testLockId,
          reservationId: testReservationId,
          pin: '555555',
          pinHash: '$2b$10$test.hashedpin5',
          status: 'ACTIVE',
          providerRef: 'provider-ref-ok',
        },
      });

      console.log(
        '\nTestando erro parcial do lock provider (1 falha, 1 sucesso)'
      );

      // Mock LockProviderFactory com provider que falha em uma chamada
      const mockProvider = new MockLockProvider();
      jest.spyOn(mockProvider, 'revokePin').mockImplementation(
        async (lockId: string, providerRef: string) => {
          if (providerRef === 'provider-ref-will-fail') {
            throw new Error('Lock provider failed for this credential');
          }
          return { success: true };
        }
      );

      LockProviderFactory.setProvider(mockProvider);

      // Dados do job
      const jobData: RevokePinJobData = {
        reservationId: testReservationId,
      };

      // Mock do Job
      const mockJob = {
        id: 'job-revoke-partial-fail-123',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<RevokePinJobData>;

      // Executar job
      const result: RevokePinJobResult = await processRevokePin(mockJob);

      // ===================================================================
      // Asserts
      // ===================================================================
      // Deve ter revogado pelo menos 1 credential (o que não falhou)
      expect(result.revokedCredentials).toBeGreaterThanOrEqual(1);

      // cred2 deve estar REVOKED
      const updated2 = await prisma.credential.findUnique({
        where: { id: cred2.id },
      });
      expect(updated2?.status).toBe('REVOKED');

      console.log(
        `✅ Job continuou processando - revogados: ${result.revokedCredentials}`
      );
    });
  });

  describe('Audit Logging', () => {
    it('deve criar audit log detalhado com requestId', async () => {
      // Criar credential
      const credential = await prisma.credential.create({
        data: {
          lockId: testLockId,
          reservationId: testReservationId,
          pin: '666666',
          pinHash: '$2b$10$test.hashedpin6',
          status: 'ACTIVE',
          providerRef: 'provider-ref-audit',
        },
      });

      console.log('\nTestando criação de audit log');

      // Mock LockProviderFactory
      const mockProvider = new MockLockProvider();
      LockProviderFactory.setProvider(mockProvider);

      // Dados do job
      const jobData: RevokePinJobData = {
        reservationId: testReservationId,
      };

      // Mock do Job
      const mockJob = {
        id: 'job-revoke-audit-123',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<RevokePinJobData>;

      // Executar job
      const result: RevokePinJobResult = await processRevokePin(mockJob);

      // ===================================================================
      // Asserts
      // ===================================================================
      expect(result.success).toBe(true);

      // Buscar audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'REVOKE_CREDENTIAL',
          entityId: testReservationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(auditLog).not.toBeNull();
      expect((auditLog?.details as any).revokedCount).toBe(1);
      expect((auditLog?.details as any).requestId).toBeDefined();
      expect((auditLog?.details as any).credentialIds).toContain(
        credential.id
      );

      console.log('✅ Audit log criado com requestId:');
      console.log(`  - RequestId: ${(auditLog?.details as any).requestId}`);
      console.log(`  - Revogados: ${(auditLog?.details as any).revokedCount}`);
    });
  });

  describe('Provider Reference Fallback', () => {
    it('deve usar PIN como fallback quando providerRef está vazio', async () => {
      // Criar credential SEM providerRef (null)
      const credential = await prisma.credential.create({
        data: {
          lockId: testLockId,
          reservationId: testReservationId,
          pin: '777777',
          pinHash: '$2b$10$test.hashedpin7',
          status: 'ACTIVE',
          providerRef: null, // Sem provider ref
        },
      });

      console.log(
        '\nTestando fallback para PIN quando providerRef está null'
      );

      // Mock LockProviderFactory
      const mockProvider = new MockLockProvider();
      const revokeSpySpy = jest.spyOn(mockProvider, 'revokePin');

      LockProviderFactory.setProvider(mockProvider);

      // Dados do job
      const jobData: RevokePinJobData = {
        reservationId: testReservationId,
      };

      // Mock do Job
      const mockJob = {
        id: 'job-revoke-fallback-123',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<RevokePinJobData>;

      // Executar job
      const result: RevokePinJobResult = await processRevokePin(mockJob);

      // ===================================================================
      // Asserts
      // ===================================================================
      expect(result.success).toBe(true);

      // Deve ter sido chamado com PIN como fallback
      expect(revokeSpySpy).toHaveBeenCalledWith(testLockId, '777777');

      console.log('✅ Fallback para PIN funcionando');
    });
  });
});
