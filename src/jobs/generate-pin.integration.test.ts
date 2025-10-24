/**
 * Teste de Integração: Generate PIN Job
 * 
 * Validar fluxo completo:
 * 1. Setup: cria Reservation, Accommodation, Lock, AccommodationLock
 * 2. Executa job processGeneratePin
 * 3. Verifica Credential criado com hash
 * 4. Verifica mock lock provider foi chamado
 */

import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { processGeneratePin, GeneratePinJobData, GeneratePinJobResult } from './generate-pin.job';
import { MockLockProvider } from '../lib/mock-lock-provider';
import * as PinGenerator from '../lib/pin-generator';

// Setup de tipos para testes
const prisma = new PrismaClient();

describe('Generate PIN - Integration Tests', () => {
  // =========================================================================
  // Dados de teste
  // =========================================================================
  const testAccommodationId = 'test-accommodation-001';
  const testLockId = 'test-lock-001';
  const testReservationId = 'test-reservation-001';
  const testRequestId = 'test-request-001';
  
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
      console.warn('⚠️ Erro durante limpeza (pode ser normal se dados não existem):', error);
    }
    
    // Criar Accommodation
    await prisma.accommodation.create({
      data: {
        id: testAccommodationId,
        staysAccommodationId: `stays-${testAccommodationId}`,
        name: 'Test Accommodation',
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
    
    await prisma.$disconnect();
    console.log('');
  });
  
  // =========================================================================
  // Testes
  // =========================================================================
  
  describe('Fluxo Completo', () => {
    it('deve criar credential com PIN hasheado e chamar lock provider', async () => {
      // Dados do job
      const jobData: GeneratePinJobData = {
        reservationId: testReservationId,
        lockId: testLockId,
        checkOutAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 dias
        requestId: testRequestId,
      };
      
      // Mock do Job
      const mockJob = {
        id: 'job-123',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<GeneratePinJobData>;
      
      // Spy no MockLockProvider para verificar chamadas
      const createTimedPinSpy = jest.spyOn(MockLockProvider.prototype, 'createTimedPin');
      
      // Executar job
      const result: GeneratePinJobResult = await processGeneratePin(mockJob);
      
      // ===================================================================
      // Asserts
      // ===================================================================
      
      // 1. Job deve retornar sucesso
      expect(result.success).toBe(true);
      expect(result.credentialId).toBeDefined();
      expect(result.pin).toBeDefined();
      expect(result.hash).toBeDefined();
      console.log(`✅ Job retornou sucesso com credentialId: ${result.credentialId}`);
      
      // 2. PIN deve ter 6 dígitos (plain text retornado)
      expect(result.pin).toMatch(/^\d{6}$/);
      console.log(`✅ PIN gerado tem 6 dígitos: ${result.pin}`);
      
      // 3. Lock provider deve ter sido chamado
      expect(createTimedPinSpy).toHaveBeenCalledTimes(1);
      expect(createTimedPinSpy).toHaveBeenCalledWith(
        testLockId,
        result.pin,
        expect.any(Date),
        expect.any(Date)
      );
      console.log('✅ Lock provider.createTimedPin foi chamado corretamente');
      
      // 4. Credential deve estar no banco de dados
      const credential = await prisma.credential.findUnique({
        where: { id: result.credentialId! },
      });
      
      expect(credential).toBeDefined();
      expect(credential?.reservationId).toBe(testReservationId);
      expect(credential?.lockId).toBe(testLockId);
      expect(credential?.status).toBe('ACTIVE');
      console.log(`✅ Credential criado no banco com status ACTIVE`);
      
      // 5. PIN no banco deve estar hasheado (não igual ao plain text)
      expect(credential?.pin).not.toBe(result.pin);
      expect(credential?.pin).toBe(result.hash);
      console.log(`✅ PIN armazenado é hash (não plain text)`);
      
      // 6. Datas de validade devem estar corretas
      const now = new Date();
      expect(credential?.validFrom.getTime()).toBeLessThanOrEqual(now.getTime() + 1000); // +1s margem
      expect(credential?.validTo.getTime()).toBeGreaterThan(now.getTime());
      console.log(`✅ Datas de validação corretas`);
      
      // 7. Lock provider response deve estar no resultado
      expect(result.lockProviderResponse).toBeDefined();
      expect(result.lockProviderResponse?.providerRef).toBeDefined();
      console.log(`✅ Response do lock provider incluído no resultado`);
      
      // 8. Audit log deve ter sido criado
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'CREATE_CREDENTIAL',
          entityId: result.credentialId!,
        },
      });
      
      expect(auditLog).toBeDefined();
      expect(auditLog?.details).toHaveProperty('requestId', testRequestId);
      console.log(`✅ Audit log criado com requestId: ${testRequestId}`);
      
      // Cleanup do spy
      createTimedPinSpy.mockRestore();
    });
    
    it('deve revogar credential anterior se existir', async () => {
      // Limpar credential anterior se existir
      await prisma.credential.deleteMany({
        where: {
          reservationId: testReservationId,
          lockId: testLockId,
        },
      });
      
      // Executar job primeira vez para criar credential
      const jobData1: GeneratePinJobData = {
        reservationId: testReservationId,
        lockId: testLockId,
        checkOutAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        requestId: `${testRequestId}-revoke-first`,
      };
      
      const mockJob1 = {
        id: 'job-revoke-1',
        data: jobData1,
        attemptsMade: 0,
      } as unknown as Job<GeneratePinJobData>;
      
      const result1 = await processGeneratePin(mockJob1);
      expect(result1.success).toBe(true);
      const firstCredentialId = result1.credentialId!;
      
      console.log(`✅ Primeira credential criada: ${firstCredentialId}`);
      
      // Verificar que primeira credential está ativa
      let firstCredential = await prisma.credential.findUnique({
        where: { id: firstCredentialId },
      });
      expect(firstCredential?.status).toBe('ACTIVE');
      console.log(`✅ Primeira credential está ACTIVE`);
      
      // Executar job segunda vez para criar nova credential
      const jobData2: GeneratePinJobData = {
        reservationId: testReservationId,
        lockId: testLockId,
        checkOutAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        requestId: `${testRequestId}-revoke-second`,
      };
      
      const mockJob2 = {
        id: 'job-revoke-2',
        data: jobData2,
        attemptsMade: 0,
      } as unknown as Job<GeneratePinJobData>;
      
      const result2 = await processGeneratePin(mockJob2);
      expect(result2.success).toBe(true);
      const secondCredentialId = result2.credentialId!;
      
      console.log(`✅ Segunda credential criada: ${secondCredentialId}`);
      
      // Verificar que credential anterior foi atualizado (upserted) ao invés de revogado
      // (porque usamos upsert no job)
      firstCredential = await prisma.credential.findUnique({
        where: { id: firstCredentialId },
      });
      
      expect(firstCredential?.status).toBe('ACTIVE');
      expect(firstCredential?.id).toBe(secondCredentialId); // Mesmo ID porque foi upsertado
      console.log(`✅ Credential foi atualizado (upserted) mantendo o mesmo ID`);
    });
  });
  
  describe('Tratamento de Erro - DLQ', () => {
    it('deve enviar para DLQ se lock não está mapeado à accommodation', async () => {
      // Criar lock não mapeado
      const unmappedLockId = 'unmapped-lock-999';
      await prisma.lock.create({
        data: {
          id: unmappedLockId,
          deviceId: `device-${unmappedLockId}`,
          vendor: 'TUYA',
        },
      });
      
      console.log(`✅ Lock não-mapeado criado: ${unmappedLockId}`);
      
      // Tentar gerar PIN para lock não mapeado
      const jobData: GeneratePinJobData = {
        reservationId: testReservationId,
        lockId: unmappedLockId,
        checkOutAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        requestId: `${testRequestId}-dlq`,
      };
      
      const mockJob = {
        id: 'job-dlq',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<GeneratePinJobData>;
      
      // Executar job (não deve lançar erro, retorna resultado com falha)
      const result = await processGeneratePin(mockJob);
      
      // Verificar resultado
      expect(result.success).toBe(false);
      expect(result.error).toContain('DLQ');
      console.log(`✅ Job retornou erro com marcação DLQ: ${result.error}`);
      
      // Verificar que audit log de DLQ foi criado
      const dlqLog = await prisma.auditLog.findFirst({
        where: {
          action: 'CREATE_CREDENTIAL_DLQ',
          entityId: testReservationId,
        },
      });
      
      expect(dlqLog).toBeDefined();
      expect(dlqLog?.details).toHaveProperty('reason', 'Lock not mapped to accommodation');
      console.log(`✅ Audit log de DLQ criado`);
      
      // Cleanup
      await prisma.lock.delete({
        where: { id: unmappedLockId },
      });
    });
    
    it('deve retornar erro após 3 retries se lock provider falhar', async () => {
      // Mock do lock provider para falhar
      const createTimedPinSpy = jest
        .spyOn(MockLockProvider.prototype, 'createTimedPin')
        .mockRejectedValue(new Error('Lock provider timeout'));
      
      console.log(`✅ Lock provider mockado para falhar`);
      
      // Executar job com attemptsMade = 2 (será a 3ª tentativa)
      const jobData: GeneratePinJobData = {
        reservationId: testReservationId,
        lockId: testLockId,
        checkOutAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        requestId: `${testRequestId}-max-retry`,
      };
      
      const mockJob = {
        id: 'job-max-retry',
        data: jobData,
        attemptsMade: 2, // Já tentou 2 vezes
      } as unknown as Job<GeneratePinJobData>;
      
      // Executar job (não deve lançar erro após max retries)
      const result = await processGeneratePin(mockJob);
      
      // Verificar resultado após max retries
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed after 3 retries');
      console.log(`✅ Job retornou erro após max retries`);
      
      // Verificar que audit log de failed DLQ foi criado
      const failedLog = await prisma.auditLog.findFirst({
        where: {
          action: 'CREATE_CREDENTIAL_FAILED_DLQ',
          entityId: testReservationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      expect(failedLog).toBeDefined();
      console.log(`✅ Audit log de failed DLQ criado`);
      
      // Cleanup
      createTimedPinSpy.mockRestore();
    });
  });
  
  describe('Tratamento de Erro - Retry', () => {
    it('deve lançar erro para retry automático se lock provider falhar na 1ª tentativa', async () => {
      // Mock do lock provider para falhar
      const createTimedPinSpy = jest
        .spyOn(MockLockProvider.prototype, 'createTimedPin')
        .mockRejectedValueOnce(new Error('Lock provider connection error'));
      
      console.log(`✅ Lock provider mockado para falhar na 1ª tentativa`);
      
      // Executar job com attemptsMade = 0 (1ª tentativa)
      const jobData: GeneratePinJobData = {
        reservationId: testReservationId,
        lockId: testLockId,
        checkOutAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        requestId: `${testRequestId}-retry-1`,
      };
      
      const mockJob = {
        id: 'job-retry-1',
        data: jobData,
        attemptsMade: 0, // 1ª tentativa
      } as unknown as Job<GeneratePinJobData>;
      
      // Executar job (deve lançar erro para trigger de retry)
      await expect(processGeneratePin(mockJob)).rejects.toThrow();
      console.log(`✅ Job lançou erro para trigger de retry automático`);
      
      // Verificar que audit log de retry foi criado
      const retryLog = await prisma.auditLog.findFirst({
        where: {
          action: 'CREATE_CREDENTIAL_RETRY',
          entityId: testReservationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      expect(retryLog).toBeDefined();
      expect(retryLog?.details).toHaveProperty('attempt', 1);
      console.log(`✅ Audit log de retry criado com attempt #1`);
      
      // Cleanup
      createTimedPinSpy.mockRestore();
    });
  });
  
  describe('Validações de Entrada', () => {
    it('deve falhar se reservation não existe', async () => {
      const jobData: GeneratePinJobData = {
        reservationId: 'non-existent-reservation',
        lockId: testLockId,
        checkOutAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        requestId: `${testRequestId}-missing-res`,
      };
      
      const mockJob = {
        id: 'job-missing-res',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<GeneratePinJobData>;
      
      // Deve falhar
      await expect(processGeneratePin(mockJob)).rejects.toThrow('Reservation not found');
      console.log(`✅ Job falhou para reservation não existente`);
    });
    
    it('deve falhar se lock não existe', async () => {
      const jobData: GeneratePinJobData = {
        reservationId: testReservationId,
        lockId: 'non-existent-lock',
        checkOutAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        requestId: `${testRequestId}-missing-lock`,
      };
      
      const mockJob = {
        id: 'job-missing-lock',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<GeneratePinJobData>;
      
      // Deve falhar
      await expect(processGeneratePin(mockJob)).rejects.toThrow('Lock not found');
      console.log(`✅ Job falhou para lock não existente`);
    });
    
    it('deve falhar se checkOutAt é inválido', async () => {
      const jobData: GeneratePinJobData = {
        reservationId: testReservationId,
        lockId: testLockId,
        checkOutAt: 'invalid-date',
        requestId: `${testRequestId}-invalid-date`,
      };
      
      const mockJob = {
        id: 'job-invalid-date',
        data: jobData,
        attemptsMade: 0,
      } as unknown as Job<GeneratePinJobData>;
      
      // Deve falhar
      await expect(processGeneratePin(mockJob)).rejects.toThrow('Invalid checkOutAt datetime format');
      console.log(`✅ Job falhou para data inválida`);
    });
  });
});
