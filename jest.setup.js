/**
 * Jest Setup File
 * 
 * Configurações globais para todos os testes:
 * - Aumentar timeout para testes de integração
 * - Mock de variáveis de ambiente
 * - Cleanup global
 */

// Aumentar timeout para testes que acessam banco de dados
jest.setTimeout(30000);

// Mock variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/tuya_locks_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-secret-key';

// Suppress console logs durante testes (opcional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

console.log('✅ Jest setup completo');
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
