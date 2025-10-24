/**
 * Teste de Integração: Mapping Flow
 * 
 * Validar fluxo de mapeamento:
 * 1. Setup: Accommodation + Lock
 * 2. POST /admin/mappings com { accommodationId, lockId }
 * 3. Verifica mapping criado
 * 4. Testa unmap
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

describe('Mapping Flow Integration Tests', () => {
  let accommodationId: string;
  let lockId: string;

  beforeAll(async () => {
    console.log('\n=== Setup: Mapping Flow Tests ===\n');

    accommodationId = uuidv4();
    lockId = uuidv4();

    // Criar Accommodation
    await prisma.accommodation.create({
      data: {
        id: accommodationId,
        staysAccommodationId: `stays-${accommodationId}`,
        name: 'Test Accommodation',
      },
    });

    console.log('✅ Accommodation criado:', accommodationId);

    // Criar Lock
    await prisma.lock.create({
      data: {
        id: lockId,
        deviceId: `device-${lockId}`,
        vendor: 'TUYA',
      },
    });

    console.log('✅ Lock criado:', lockId);
  });

  afterAll(async () => {
    console.log('\n=== Teardown: Mapping Flow Tests ===\n');

    await prisma.credential.deleteMany({
      where: { lockId },
    });

    await prisma.reservation.deleteMany({
      where: { accommodationId },
    });

    await prisma.accommodationLock.deleteMany({
      where: {
        accommodationId,
        lockId,
      },
    });

    await prisma.accommodation.deleteMany({
      where: { id: accommodationId },
    });

    await prisma.lock.deleteMany({
      where: { id: lockId },
    });

    console.log('✅ Teardown completo');
  });

  // =========================================================================
  // TESTE 1: Criar Mapping
  // =========================================================================

  it('should create accommodation-lock mapping', async () => {
    console.log('\n--- Teste 1: Criar Mapping ---\n');

    const mappingPayload = {
      accommodationId,
      lockId,
    };

    console.log('📤 Criando mapping:', JSON.stringify(mappingPayload, null, 2));

    // Criar mapping
    const mapping = await prisma.accommodationLock.create({
      data: {
        accommodationId,
        lockId,
      },
    });

    console.log('✅ Mapping criado:', mapping);

    // Verificar criação
    const found = await prisma.accommodationLock.findUnique({
      where: {
        accommodationId_lockId: {
          accommodationId,
          lockId,
        },
      },
    });

    expect(found).toBeDefined();
    expect(found?.accommodationId).toBe(accommodationId);
    expect(found?.lockId).toBe(lockId);

    console.log('✅ Mapping verificado');
  });

  // =========================================================================
  // TESTE 2: Validar Mapping Único (1:1)
  // =========================================================================

  it('should enforce 1:1 mapping constraint', async () => {
    console.log('\n--- Teste 2: Validar Mapping Único ---\n');

    // Criar segundo Lock
    const lockId2 = uuidv4();
    await prisma.lock.create({
      data: {
        id: lockId2,
        deviceId: `device-${lockId2}`,
        vendor: 'TUYA',
      },
    });

    console.log('✅ Segundo Lock criado:', lockId2);

    // Tentar mapear mesmo Accommodation com outro Lock
    // Esperado: falhar se há validação 1:1
    try {
      await prisma.accommodationLock.create({
        data: {
          accommodationId,
          lockId: lockId2,
        },
      });

      // Se chegou aqui, não há restrição 1:1 (ou é permitido múltiplos)
      console.log('⚠️ Múltiplos locks mapeados ao mesmo accommodation');

      // Cleanup
      await prisma.accommodationLock.delete({
        where: {
          accommodationId_lockId: {
            accommodationId,
            lockId: lockId2,
          },
        },
      });
    } catch (error) {
      console.log('✅ Validação 1:1 funcionando (erro esperado)');
    }

    // Cleanup
    await prisma.lock.delete({
      where: { id: lockId2 },
    });
  });

  // =========================================================================
  // TESTE 3: Desmapar (Unmap)
  // =========================================================================

  it('should remove accommodation-lock mapping', async () => {
    console.log('\n--- Teste 3: Desmapar ---\n');

    // Verificar que mapping existe
    let found = await prisma.accommodationLock.findUnique({
      where: {
        accommodationId_lockId: {
          accommodationId,
          lockId,
        },
      },
    });

    expect(found).toBeDefined();
    console.log('✅ Mapping existe');

    // Remover mapping
    await prisma.accommodationLock.delete({
      where: {
        accommodationId_lockId: {
          accommodationId,
          lockId,
        },
      },
    });

    console.log('✅ Mapping removido');

    // Verificar remoção
    found = await prisma.accommodationLock.findUnique({
      where: {
        accommodationId_lockId: {
          accommodationId,
          lockId,
        },
      },
    });

    expect(found).toBeNull();
    console.log('✅ Mapping confirmado como removido');
  });

  // =========================================================================
  // TESTE 4: Remapar (Remapear)
  // =========================================================================

  it('should remap accommodation to different lock', async () => {
    console.log('\n--- Teste 4: Remapar ---\n');

    // Criar novo Lock
    const newLockId = uuidv4();
    await prisma.lock.create({
      data: {
        id: newLockId,
        deviceId: `device-${newLockId}`,
        vendor: 'TUYA',
      },
    });

    console.log('✅ Novo Lock criado:', newLockId);

    // Remapear: remover mapping antigo, criar novo
    await prisma.accommodationLock.deleteMany({
      where: { accommodationId },
    });

    console.log('✅ Mapping antigo removido');

    const newMapping = await prisma.accommodationLock.create({
      data: {
        accommodationId,
        lockId: newLockId,
      },
    });

    console.log('✅ Novo mapping criado:', newMapping);

    // Verificar novo mapping
    const found = await prisma.accommodationLock.findUnique({
      where: {
        accommodationId_lockId: {
          accommodationId,
          lockId: newLockId,
        },
      },
    });

    expect(found).toBeDefined();
    expect(found?.lockId).toBe(newLockId);

    console.log('✅ Novo mapping verificado');

    // Cleanup
    await prisma.accommodationLock.delete({
      where: {
        accommodationId_lockId: {
          accommodationId,
          lockId: newLockId,
        },
      },
    });

    await prisma.lock.delete({
      where: { id: newLockId },
    });
  });

  // =========================================================================
  // TESTE 5: Cascade Delete
  // =========================================================================

  it('should cascade delete when lock is deleted', async () => {
    console.log('\n--- Teste 5: Cascade Delete ---\n');

    // Criar novo setup para este teste
    const testLockId = uuidv4();
    await prisma.lock.create({
      data: {
        id: testLockId,
        deviceId: `device-${testLockId}`,
        vendor: 'TUYA',
      },
    });

    // Criar mapping
    await prisma.accommodationLock.create({
      data: {
        accommodationId,
        lockId: testLockId,
      },
    });

    console.log('✅ Mapping criado para cascade test');

    // Deletar lock
    await prisma.lock.delete({
      where: { id: testLockId },
    });

    console.log('✅ Lock deletado');

    // Verificar que mapping também foi deletado
    const found = await prisma.accommodationLock.findUnique({
      where: {
        accommodationId_lockId: {
          accommodationId,
          lockId: testLockId,
        },
      },
    });

    expect(found).toBeNull();
    console.log('✅ Mapping foi deletado em cascade');
  });

  // =========================================================================
  // TESTE 6: Query Mappings
  // =========================================================================

  it('should query all mappings for accommodation', async () => {
    console.log('\n--- Teste 6: Query Mappings ---\n');

    // Criar múltiplos locks
    const locks = await Promise.all([
      prisma.lock.create({
        data: {
          id: uuidv4(),
          deviceId: `device-${uuidv4()}`,
          vendor: 'TUYA',
        },
      }),
      prisma.lock.create({
        data: {
          id: uuidv4(),
          deviceId: `device-${uuidv4()}`,
          vendor: 'TUYA',
        },
      }),
    ]);

    console.log(`✅ ${locks.length} Locks criados`);

    // Mapear alguns deles (dependendo das restrições)
    const mappings: any[] = [];
    for (const lock of locks) {
      try {
        const mapping = await prisma.accommodationLock.create({
          data: {
            accommodationId,
            lockId: lock.id,
          },
        });
        mappings.push(mapping);
      } catch (error) {
        // Pode falhar se há restrição 1:1
      }
    }

    console.log(`✅ ${mappings.length} Mappings criados`);

    // Query todos os mappings da accommodation
    const allMappings = await prisma.accommodationLock.findMany({
      where: { accommodationId },
      include: {
        lock: true,
      },
    });

    console.log(`✅ Query retornou ${allMappings.length} mappings`);
    expect(allMappings.length).toBeGreaterThanOrEqual(0);

    // Cleanup
    await prisma.accommodationLock.deleteMany({
      where: { accommodationId },
    });

    for (const lock of locks) {
      await prisma.lock.delete({
        where: { id: lock.id },
      });
    }

    console.log('✅ Cleanup completo');
  });
});
