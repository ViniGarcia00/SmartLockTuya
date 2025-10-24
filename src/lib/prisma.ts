/**
 * Prisma Client Singleton
 * 
 * Inicializa e exporta instância singleton do Prisma Client
 * para evitar múltiplas instâncias em desenvolvimento
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

let prismaClient: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prismaClient = new PrismaClient();
} else {
  // Em desenvolvimento, usar instância global para evitar múltiplas conexões
  if (!global.prismaClient) {
    global.prismaClient = new PrismaClient({
      log: ['error', 'warn'],
    });
  }
  prismaClient = global.prismaClient;
}

export const prisma = prismaClient;
export default prisma;
