import { PrismaClient } from "@prisma/client";
import { addHours, addDays } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...\n");

  // Limpar dados anteriores (ordem importa por FKs)
  console.log("🗑️  Limpando dados anteriores...");
  await prisma.auditLog.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.accommodationLock.deleteMany();
  await prisma.lock.deleteMany();
  await prisma.accommodation.deleteMany();

  // Criar Acomodações
  console.log("🏠 Criando acomodações...");
  const accommodation1 = await prisma.accommodation.create({
    data: {
      staysAccommodationId: "ACC-STY-001",
      name: "Apartamento Luxo Centro",
      status: "ACTIVE",
    },
  });
  console.log(`   ✓ ${accommodation1.name} (${accommodation1.id})`);

  const accommodation2 = await prisma.accommodation.create({
    data: {
      staysAccommodationId: "ACC-STY-002",
      name: "Studio Praia",
      status: "ACTIVE",
    },
  });
  console.log(`   ✓ ${accommodation2.name} (${accommodation2.id})`);

  const accommodation3 = await prisma.accommodation.create({
    data: {
      staysAccommodationId: "ACC-STY-003",
      name: "Casa Temporada",
      status: "INACTIVE",
    },
  });
  console.log(`   ✓ ${accommodation3.name} (${accommodation3.id})`);

  // Criar Fechaduras
  console.log("\n🔐 Criando fechaduras...");
  const lock1 = await prisma.lock.create({
    data: {
      vendor: "TUYA",
      deviceId: "bf3db4a6b2d8c0f1e2a3b4c5",
      alias: "Fechadura Porta Principal",
    },
  });
  console.log(`   ✓ ${lock1.alias} (Tuya: ${lock1.deviceId})`);

  const lock2 = await prisma.lock.create({
    data: {
      vendor: "TUYA",
      deviceId: "eb97495fa9681bedeftre0",
      alias: "Fechadura Vinicius",
    },
  });
  console.log(`   ✓ ${lock2.alias} (Tuya: ${lock2.deviceId})`);

  const lock3 = await prisma.lock.create({
    data: {
      vendor: "TUYA",
      deviceId: "eb14a8ffa1a790c0a6kwmd",
      alias: "Fechadura Fiberwan",
    },
  });
  console.log(`   ✓ ${lock3.alias} (Tuya: ${lock3.deviceId})`);

  // Vincular Acomodações a Fechaduras
  console.log("\n🔗 Vinculando acomodações a fechaduras...");
  const link1 = await prisma.accommodationLock.create({
    data: {
      accommodationId: accommodation1.id,
      lockId: lock1.id,
      createdBy: "admin@example.com",
    },
  });
  console.log(
    `   ✓ ${accommodation1.name} → ${lock1.alias}`
  );

  const link2 = await prisma.accommodationLock.create({
    data: {
      accommodationId: accommodation2.id,
      lockId: lock2.id,
      createdBy: "admin@example.com",
    },
  });
  console.log(
    `   ✓ ${accommodation2.name} → ${lock2.alias}`
  );

  const link3 = await prisma.accommodationLock.create({
    data: {
      accommodationId: accommodation3.id,
      lockId: lock3.id,
      createdBy: "admin@example.com",
    },
  });
  console.log(
    `   ✓ ${accommodation3.name} → ${lock3.alias}`
  );

  // Criar Reservas
  console.log("\n📅 Criando reservas...");
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const nextDay = addDays(now, 2);
  const futureDate = addDays(now, 10);

  const reservation1 = await prisma.reservation.create({
    data: {
      staysReservationId: "RES-STY-202510-001",
      accommodationId: accommodation1.id,
      checkInAt: tomorrow,
      checkOutAt: addDays(tomorrow, 3),
      status: "CONFIRMED",
    },
  });
  console.log(
    `   ✓ Reserva 1: ${reservation1.staysReservationId} (${reservation1.status})`
  );

  const reservation2 = await prisma.reservation.create({
    data: {
      staysReservationId: "RES-STY-202510-002",
      accommodationId: accommodation2.id,
      checkInAt: futureDate,
      checkOutAt: addDays(futureDate, 2),
      status: "PENDING",
    },
  });
  console.log(
    `   ✓ Reserva 2: ${reservation2.staysReservationId} (${reservation2.status})`
  );

  // Criar Credenciais (PINs)
  console.log("\n🔑 Criando credenciais (PINs)...");
  const credential1 = await prisma.credential.create({
    data: {
      reservationId: reservation1.id,
      lockId: lock1.id,
      pin: "$2b$10$abcdefghijklmnopqrstuvwxyz", // hash bcrypt simulado
      plainPin: "1234567", // Temporário
      status: "ACTIVE",
      validFrom: addHours(tomorrow, 15), // Check-in + 1h
      validTo: addDays(tomorrow, 3),     // Check-out
      createdBy: "system",
    },
  });
  console.log(
    `   ✓ PIN para ${reservation1.staysReservationId}: 1234567 (válido até ${credential1.validTo.toLocaleDateString()})`
  );

  const credential2 = await prisma.credential.create({
    data: {
      reservationId: reservation2.id,
      lockId: lock2.id,
      pin: "$2b$10$zyxwvutsrqponmlkjihgfedcb",
      plainPin: "9876543",
      status: "ACTIVE",
      validFrom: addHours(futureDate, 15),
      validTo: addDays(futureDate, 2),
      createdBy: "system",
    },
  });
  console.log(
    `   ✓ PIN para ${reservation2.staysReservationId}: 9876543 (válido até ${credential2.validTo.toLocaleDateString()})`
  );

  // Criar Eventos de Webhook
  console.log("\n📡 Criando eventos de webhook...");
  const webhook1 = await prisma.webhookEvent.create({
    data: {
      eventId: "550e8400-e29b-41d4-a716-446655440000",
      eventType: "reservation.created",
      reservationId: reservation1.id,
      rawBody: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        eventType: "reservation.created",
        timestamp: new Date().toISOString(),
        data: {
          reservationId: reservation1.staysReservationId,
          accommodationId: accommodation1.staysAccommodationId,
          checkIn: tomorrow.toISOString(),
          checkOut: addDays(tomorrow, 3).toISOString(),
        },
      },
      processed: true,
      processedAt: new Date(),
    },
  });
  console.log(`   ✓ Webhook: ${webhook1.eventType} (processado)`);

  const webhook2 = await prisma.webhookEvent.create({
    data: {
      eventId: "550e8400-e29b-41d4-a716-446655440001",
      eventType: "reservation.confirmed",
      reservationId: reservation2.id,
      rawBody: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        eventType: "reservation.confirmed",
        timestamp: new Date().toISOString(),
        data: {
          reservationId: reservation2.staysReservationId,
        },
      },
      processed: false,
    },
  });
  console.log(`   ✓ Webhook: ${webhook2.eventType} (pendente)`);

  // Criar Logs de Auditoria
  console.log("\n📝 Criando logs de auditoria...");
  const audit1 = await prisma.auditLog.create({
    data: {
      action: "CREATE_CREDENTIAL",
      entity: "Credential",
      entityId: credential1.id,
      userId: "admin@example.com",
      details: {
        pin: "1234567",
        reservationId: reservation1.id,
        lockId: lock1.id,
      },
    },
  });
  console.log(`   ✓ Auditoria: CREATE_CREDENTIAL (${credential1.id})`);

  const audit2 = await prisma.auditLog.create({
    data: {
      action: "WEBHOOK_PROCESSED",
      entity: "WebhookEvent",
      entityId: webhook1.id,
      userId: "system",
      details: {
        eventType: webhook1.eventType,
        reservationId: reservation1.id,
      },
    },
  });
  console.log(`   ✓ Auditoria: WEBHOOK_PROCESSED (${webhook1.id})`);

  // Resumo
  console.log("\n✅ Seed concluído com sucesso!\n");
  console.log("📊 Resumo:");
  console.log(`   • Acomodações: 3`);
  console.log(`   • Fechaduras: 3`);
  console.log(`   • Vínculo Acomodação-Fechadura: 3`);
  console.log(`   • Reservas: 2`);
  console.log(`   • Credenciais (PINs): 2`);
  console.log(`   • Eventos de Webhook: 2`);
  console.log(`   • Logs de Auditoria: 2`);
  console.log("\n💡 Dica: Execute 'npx prisma studio' para visualizar os dados graficamente!\n");
}

main()
  .catch((e) => {
    console.error("❌ Erro durante seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
