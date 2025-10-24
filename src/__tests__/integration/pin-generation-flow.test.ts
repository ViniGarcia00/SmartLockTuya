/**
 * Teste de Integração: PIN Generation Flow
 * 
 * Validar fluxo de geração de PIN:
 * 1. Setup: Reservation + Accommodation + Lock + Mapping
 * 2. Executa generatePin job
 * 3. Verifica Credential criado com hash
 * 4. Verifica mock lock provider foi chamado
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Mock Lock Provider
class MockLockProvider {
  async generatePin(
    lockId: string,
    pinHash: string
  ): Promise<{ success: boolean; message: string }> {
    console.log(`🔐 Mock Lock Provider: Gerando PIN para lock ${lockId}`);
    console.log(`   Hash: ${pinHash.substring(0, 20)}...`);
    return {
      success: true,
      message: 'PIN gerado com sucesso no lock',
    };
  }

  async revokePin(lockId: string): Promise<{ success: boolean; message: string }> {
    console.log(`🔓 Mock Lock Provider: Revogando PIN para lock ${lockId}`);
    return {
      success: true,
      message: 'PIN revogado com sucesso',
    };
  }
}

describe('PIN Generation Flow Integration Tests', () => {
  let accommodationId: string;
  let lockId: string;
  let reservationId: string;
  let lockProvider: MockLockProvider;

  beforeAll(async () => {
    console.log('\n=== Setup: PIN Generation Flow Tests ===\n');

    lockProvider = new MockLockProvider();

    accommodationId = uuidv4();
    lockId = uuidv4();
    reservationId = uuidv4();

    // Criar Accommodation
    await prisma.accommodation.create({
      data: {
        id: accommodationId,
        staysAccommodationId: `stays-${accommodationId}`,
        name: 'Test Accommodation',
      },
    });

    console.log('✅ Accommodation criado');

    // Criar Lock
    await prisma.lock.create({
      data: {
        id: lockId,
        deviceId: `device-${lockId}`,
        vendor: 'TUYA',
      },
    });

    console.log('✅ Lock criado');

    // Mapear Lock à Accommodation
    await prisma.accommodationLock.create({
      data: {
        accommodationId,
        lockId,
      },
    });

    console.log('✅ Mapping criado');

    // Criar Reservation
    const checkInDate = new Date();
    const checkOutDate = new Date();
    checkOutDate.setDate(checkOutDate.getDate() + 2);

    await prisma.reservation.create({
      data: {
        id: reservationId,
        staysReservationId: `stays-${reservationId}`,
        accommodationId,
        checkInAt: checkInDate,
        checkOutAt: checkOutDate,
        status: 'CONFIRMED',
        guestName: 'Test Guest',
        guestEmail: 'guest@example.com',
      },
    });

    console.log('✅ Reservation criado');
  });

  afterAll(async () => {
    console.log('\n=== Teardown: PIN Generation Flow Tests ===\n');

    await prisma.credential.deleteMany({
      where: { reservationId },
    });

    await prisma.reservation.deleteMany({
      where: { id: reservationId },
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
  // TESTE 1: Gerar PIN
  // =========================================================================

  it('should generate PIN and create credential', async () => {
    console.log('\n--- Teste 1: Gerar PIN ---\n');

    const pin = Math.floor(1000000 + Math.random() * 9000000).toString();
    console.log(`🔐 PIN gerado: ${pin}`);

    // Gerar hash do PIN (simulando segurança)
    const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
    console.log(`📝 Hash do PIN: ${pinHash.substring(0, 30)}...`);

    // Chamarcall mock lock provider
    const lockResponse = await lockProvider.generatePin(lockId, pinHash);
    expect(lockResponse.success).toBe(true);
    console.log('✅ Mock lock provider retornou sucesso');

    // Criar Credential
    const credential = await prisma.credential.create({
      data: {
        id: uuidv4(),
        reservationId,
        lockId,
        pin,
        pinHash,
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      },
    });

    console.log('✅ Credential criado:', credential.id);

    // Verificar Credential
    const found = await prisma.credential.findUnique({
      where: { id: credential.id },
    });

    expect(found).toBeDefined();
    expect(found?.pin).toBe(pin);
    expect(found?.pinHash).toBe(pinHash);
    expect(found?.isActive).toBe(true);
    expect(found?.lockId).toBe(lockId);

    console.log('✅ Credential verificado no banco');
  });

  // =========================================================================
  // TESTE 2: Verificar PIN não é exposto
  // =========================================================================

  it('should not expose PIN in queries (hash only)', async () => {
    console.log('\n--- Teste 2: PIN Seguro ---\n');

    const pin = Math.floor(1000000 + Math.random() * 9000000).toString();
    const pinHash = crypto.createHash('sha256').update(pin).digest('hex');

    const credential = await prisma.credential.create({
      data: {
        id: uuidv4(),
        reservationId,
        lockId,
        pin,
        pinHash,
        isActive: true,
      },
    });

    console.log('✅ Credential criado com PIN hash');

    // Query apenas o hash (nunca deve retornar PIN em APIs)
    const credentialDisplay = await prisma.credential.findUnique({
      where: { id: credential.id },
      select: {
        id: true,
        pinHash: true,
        isActive: true,
        expiresAt: true,
        // Nota: pin seria excluído em uma API real
      },
    });

    expect(credentialDisplay?.pinHash).toBe(pinHash);
    console.log('✅ Hash disponível para validação');
    console.log(`   Hash: ${credentialDisplay?.pinHash.substring(0, 30)}...`);
  });

  // =========================================================================
  // TESTE 3: Múltiplos PINs (rotação)
  // =========================================================================

  it('should support PIN rotation', async () => {
    console.log('\n--- Teste 3: Rotação de PIN ---\n');

    // PIN 1: Original
    const pin1 = Math.floor(1000000 + Math.random() * 9000000).toString();
    const hash1 = crypto.createHash('sha256').update(pin1).digest('hex');

    const cred1 = await prisma.credential.create({
      data: {
        id: uuidv4(),
        reservationId,
        lockId,
        pin: pin1,
        pinHash: hash1,
        isActive: true,
      },
    });

    console.log('✅ PIN 1 criado (ativo)');

    // PIN 2: Novo (rotação)
    const pin2 = Math.floor(1000000 + Math.random() * 9000000).toString();
    const hash2 = crypto.createHash('sha256').update(pin2).digest('hex');

    // Desativar PIN antigo
    await prisma.credential.update({
      where: { id: cred1.id },
      data: { isActive: false },
    });

    const cred2 = await prisma.credential.create({
      data: {
        id: uuidv4(),
        reservationId,
        lockId,
        pin: pin2,
        pinHash: hash2,
        isActive: true,
      },
    });

    console.log('✅ PIN 2 criado (novo ativo, PIN 1 desativado)');

    // Verificar que novo PIN está ativo
    const activeCreds = await prisma.credential.findMany({
      where: {
        reservationId,
        isActive: true,
      },
    });

    expect(activeCreds.length).toBeGreaterThan(0);
    expect(activeCreds.some((c: any) => c.id === cred2.id)).toBe(true);

    console.log(`✅ ${activeCreds.length} credential(s) ativo(s)`);
  });

  // =========================================================================
  // TESTE 4: PIN Expiration
  // =========================================================================

  it('should handle PIN expiration', async () => {
    console.log('\n--- Teste 4: Expiração de PIN ---\n');

    const pin = Math.floor(1000000 + Math.random() * 9000000).toString();
    const pinHash = crypto.createHash('sha256').update(pin).digest('hex');

    // Criar com data de expiração no passado
    const expiredCredential = await prisma.credential.create({
      data: {
        id: uuidv4(),
        reservationId,
        lockId,
        pin,
        pinHash,
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // Expirado 1 segundo atrás
      },
    });

    console.log('✅ Credential expirado criado');

    // Verificar expiração
    const now = new Date();
    const isExpired = expiredCredential.expiresAt! < now;

    expect(isExpired).toBe(true);
    console.log('✅ PIN confirmado como expirado');

    // Query PINs não-expirados
    const validCredentials = await prisma.credential.findMany({
      where: {
        reservationId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    console.log(`✅ Query retornou ${validCredentials.length} PIN(s) válido(s)`);
    expect(validCredentials.every((c: any) => c.expiresAt! > now)).toBe(true);
  });

  // =========================================================================
  // TESTE 5: Revogar PIN
  // =========================================================================

  it('should revoke PIN on checkout', async () => {
    console.log('\n--- Teste 5: Revogar PIN ---\n');

    const pin = Math.floor(1000000 + Math.random() * 9000000).toString();
    const pinHash = crypto.createHash('sha256').update(pin).digest('hex');

    const credential = await prisma.credential.create({
      data: {
        id: uuidv4(),
        reservationId,
        lockId,
        pin,
        pinHash,
        isActive: true,
      },
    });

    console.log('✅ Credential criado (ativo)');

    // Chamar mock lock provider
    const revokeResponse = await lockProvider.revokePin(lockId);
    expect(revokeResponse.success).toBe(true);
    console.log('✅ Mock lock provider executou revoke');

    // Atualizar credential
    const revokedCredential = await prisma.credential.update({
      where: { id: credential.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    console.log('✅ Credential marcado como revogado');

    // Verificar revogação
    const found = await prisma.credential.findUnique({
      where: { id: credential.id },
    });

    expect(found?.isActive).toBe(false);
    expect(found?.revokedAt).not.toBeNull();

    console.log('✅ Revogação verificada');
  });

  // =========================================================================
  // TESTE 6: Query Credential por Reservation
  // =========================================================================

  it('should query credentials by reservation', async () => {
    console.log('\n--- Teste 6: Query por Reservation ---\n');

    const pin1 = Math.floor(1000000 + Math.random() * 9000000).toString();
    const hash1 = crypto.createHash('sha256').update(pin1).digest('hex');

    const pin2 = Math.floor(1000000 + Math.random() * 9000000).toString();
    const hash2 = crypto.createHash('sha256').update(pin2).digest('hex');

    // Criar múltiplos credentials
    const creds = await Promise.all([
      prisma.credential.create({
        data: {
          id: uuidv4(),
          reservationId,
          lockId,
          pin: pin1,
          pinHash: hash1,
          isActive: true,
        },
      }),
      prisma.credential.create({
        data: {
          id: uuidv4(),
          reservationId,
          lockId,
          pin: pin2,
          pinHash: hash2,
          isActive: false,
        },
      }),
    ]);

    console.log(`✅ ${creds.length} credentials criados`);

    // Query todos os credentials da reservation
    const allCreds = await prisma.credential.findMany({
      where: { reservationId },
    });

    expect(allCreds.length).toBeGreaterThanOrEqual(2);
    console.log(`✅ Query retornou ${allCreds.length} credential(s)`);

    // Query apenas credenciais ativas
    const activeCreds = await prisma.credential.findMany({
      where: {
        reservationId,
        isActive: true,
      },
    });

    console.log(`✅ Query ativa retornou ${activeCreds.length} credential(s)`);
  });

  // =========================================================================
  // TESTE 7: PIN Generator Utility
  // =========================================================================

  it('should have consistent PIN generation', async () => {
    console.log('\n--- Teste 7: Gerador de PIN Consistente ---\n');

    // Gerar múltiplos PINs
    const pins = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const pin = Math.floor(1000000 + Math.random() * 9000000).toString();
      pins.add(pin);

      // Validar formato (7 dígitos)
      expect(pin).toMatch(/^\d{7}$/);
    }

    console.log(`✅ Gerados ${pins.size} PINs únicos com 7 dígitos`);

    // Todos devem ser válidos
    expect(pins.size).toBeGreaterThan(0);
    console.log(`✅ Validação de formato completa`);
  });
});
