/**
 * Exemplos de uso dos tipos e validação de ambiente
 * Este arquivo demonstra como usar stays.types.ts e env.ts
 */

// ============================================================================
// Exemplo 1: Validação de Variáveis de Ambiente
// ============================================================================

import {
  getEnvironment,
  getEnv,
  isProduction,
  isDevelopment,
  isMockEnabled,
  getStaysConfig,
  getDatabaseConfig,
  getRedisConfig,
  getDatabaseUrl,
  getRedisUrl,
} from './env';

export function exemplo1_ValidarEnvironment() {
  console.log('=== Exemplo 1: Validação de Variáveis de Ambiente ===\n');

  try {
    // Obter todas as variáveis validadas
    const env = getEnvironment();
    console.log('✓ Todas as variáveis de ambiente validadas com sucesso');
    console.log(`  NODE_ENV: ${env.NODE_ENV}`);
    console.log(`  PORT: ${env.PORT}`);
    console.log(`  DB: ${env.DB_USER}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
    console.log(`  Stays Base URL: ${env.STAYS_BASE_URL}`);
    console.log(`  Stays Mock Enabled: ${env.STAYS_ENABLE_MOCK}`);
  } catch (error) {
    console.error('✗ Erro na validação:', error);
  }
}

// ============================================================================
// Exemplo 2: Usar Funções Helpers de Ambiente
// ============================================================================

export function exemplo2_HelpersAmbiente() {
  console.log('\n=== Exemplo 2: Helpers de Ambiente ===\n');

  // Verificar ambiente
  console.log(`Ambiente: ${getEnv('NODE_ENV')}`);
  console.log(`Está em produção? ${isProduction()}`);
  console.log(`Está em desenvolvimento? ${isDevelopment()}`);
  console.log(`MOCK habilitado? ${isMockEnabled()}`);

  // Obter valores específicos
  const port = getEnv('PORT');
  const jwtSecret = getEnv('JWT_SECRET');
  console.log(`Porta: ${port}`);
  console.log(`JWT Secret está configurado? ${jwtSecret.length > 0}`);
}

// ============================================================================
// Exemplo 3: Obter Configurações Especializadas
// ============================================================================

export function exemplo3_ConfiguracoeEspecializadas() {
  console.log('\n=== Exemplo 3: Configurações Especializadas ===\n');

  try {
    // Configuração Stays
    const staysConfig = getStaysConfig();
    console.log('✓ Configuração Stays:');
    console.log(`  Client ID: ${staysConfig.clientId}`);
    console.log(`  Base URL: ${staysConfig.baseURL}`);
    console.log(`  Mock habilitado: ${staysConfig.enableMock}`);

    // Configuração Banco de Dados
    const dbConfig = getDatabaseConfig();
    console.log('\n✓ Configuração Banco de Dados:');
    console.log(`  Host: ${dbConfig.host}`);
    console.log(`  Port: ${dbConfig.port}`);
    console.log(`  Database: ${dbConfig.name}`);

    // Configuração Redis
    const redisConfig = getRedisConfig();
    console.log('\n✓ Configuração Redis:');
    console.log(`  Host: ${redisConfig.host}`);
    console.log(`  Port: ${redisConfig.port}`);

    // URLs de conexão
    const dbUrl = getDatabaseUrl();
    const redisUrl = getRedisUrl();
    console.log('\n✓ URLs de Conexão:');
    console.log(`  Database URL: ${dbUrl.replace(dbConfig.password, '***')}`);
    console.log(`  Redis URL: ${redisUrl.replace(/:[^@]*@/, ':***@')}`);
  } catch (error) {
    console.error('✗ Erro ao obter configurações:', error);
  }
}

// ============================================================================
// Exemplo 4: Usar Tipos de Stays
// ============================================================================

import { Reservation, Accommodation, StaysError, StaysApiResponse } from './stays.types';

export function exemplo4_TiposStays() {
  console.log('\n=== Exemplo 4: Tipos de Stays ===\n');

  // Criar uma reserva de exemplo
  const reserva: Reservation = {
    id: 'RES-001',
    accommodationId: 'ACC-001',
    guestName: 'João Silva',
    guestEmail: 'joao@example.com',
    checkInDate: '2025-10-24',
    checkOutDate: '2025-10-27',
    status: 'confirmed',
    numberOfGuests: 2,
    lockCode: '1234567',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log('✓ Reserva criada:');
  console.log(`  ID: ${reserva.id}`);
  console.log(`  Hóspede: ${reserva.guestName}`);
  console.log(`  Status: ${reserva.status}`);
  console.log(`  Check-in: ${reserva.checkInDate}`);
  console.log(`  Check-out: ${reserva.checkOutDate}`);

  // Criar uma acomodação de exemplo
  const acomodacao: Accommodation = {
    id: 'ACC-001',
    name: 'Apartamento Centro',
    description: 'Lindo apartamento no centro da cidade',
    address: 'Rua Principal, 123',
    city: 'São Paulo',
    country: 'Brasil',
    capacity: 4,
    bedrooms: 2,
    bathrooms: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log('\n✓ Acomodação criada:');
  console.log(`  ID: ${acomodacao.id}`);
  console.log(`  Nome: ${acomodacao.name}`);
  console.log(`  Cidade: ${acomodacao.city}`);
  console.log(`  Capacidade: ${acomodacao.capacity} hóspedes`);
}

// ============================================================================
// Exemplo 5: Tratamento de Erros com StaysError
// ============================================================================

export function exemplo5_TratamentoErros() {
  console.log('\n=== Exemplo 5: Tratamento de Erros ===\n');

  try {
    // Simular erro de autenticação
    throw new StaysError(
      'Credenciais inválidas',
      'AUTHENTICATION_ERROR',
      401,
      { reason: 'Invalid client_id' },
      'req-12345'
    );
  } catch (error) {
    if (error instanceof StaysError) {
      console.log('✓ Erro capturado:');
      console.log(`  Tipo: ${error.type}`);
      console.log(`  Status: ${error.statusCode}`);
      console.log(`  Mensagem: ${error.message}`);
      console.log(`  Request ID: ${error.requestId}`);
      console.log(`  Timestamp: ${error.timestamp}`);
      console.log(`\n  JSON:\n${JSON.stringify(error.toJSON(), null, 2)}`);
    }
  }

  // Exemplo com métodos de verificação
  try {
    throw new StaysError(
      'Timeout na requisição',
      'TIMEOUT_ERROR',
      504
    );
  } catch (error) {
    if (error instanceof StaysError) {
      console.log('\n✓ Verificações de tipo de erro:');
      console.log(`  É erro de autenticação? ${error.isAuthenticationError()}`);
      console.log(`  É erro de timeout? ${error.isTimeoutError()}`);
      console.log(`  É erro de rede? ${error.isNetworkError()}`);
    }
  }
}

// ============================================================================
// Exemplo 6: Resposta Genérica da API
// ============================================================================

export function exemplo6_RespostaAPI() {
  console.log('\n=== Exemplo 6: Resposta Genérica da API ===\n');

  // Resposta de sucesso
  const respostaSucesso: StaysApiResponse<Reservation[]> = {
    success: true,
    data: [
      {
        id: 'RES-001',
        accommodationId: 'ACC-001',
        guestName: 'João Silva',
        checkInDate: '2025-10-24',
        checkOutDate: '2025-10-27',
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    statusCode: 200,
    timestamp: new Date().toISOString(),
    metadata: {
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    },
  };

  console.log('✓ Resposta de Sucesso:');
  console.log(`  Success: ${respostaSucesso.success}`);
  console.log(`  Status: ${respostaSucesso.statusCode}`);
  console.log(`  Items retornados: ${respostaSucesso.data?.length}`);

  // Resposta de erro
  const respostaErro: StaysApiResponse = {
    success: false,
    error: 'Não autorizado',
    errorType: 'AUTHORIZATION_ERROR',
    statusCode: 403,
    timestamp: new Date().toISOString(),
    requestId: 'req-67890',
  };

  console.log('\n✓ Resposta de Erro:');
  console.log(`  Success: ${respostaErro.success}`);
  console.log(`  Erro: ${respostaErro.error}`);
  console.log(`  Tipo: ${respostaErro.errorType}`);
  console.log(`  Status: ${respostaErro.statusCode}`);
}

// ============================================================================
// Executar Todos os Exemplos
// ============================================================================

export async function executarTodosExemplos() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Exemplos de Tipos e Validação de Ambiente - Stays     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    exemplo1_ValidarEnvironment();
    exemplo2_HelpersAmbiente();
    exemplo3_ConfiguracoeEspecializadas();
    exemplo4_TiposStays();
    exemplo5_TratamentoErros();
    exemplo6_RespostaAPI();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                Exemplos Concluídos com Sucesso!          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n✗ Erro ao executar exemplos:', error);
  }
}

// Executar ao carregar o módulo (comentar em produção)
// executarTodosExemplos().catch(console.error);

export default {
  exemplo1_ValidarEnvironment,
  exemplo2_HelpersAmbiente,
  exemplo3_ConfiguracoeEspecializadas,
  exemplo4_TiposStays,
  exemplo5_TratamentoErros,
  exemplo6_RespostaAPI,
  executarTodosExemplos,
};
