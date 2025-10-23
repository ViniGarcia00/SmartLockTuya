/**
 * Exemplo de uso do StaysClient
 * 
 * Este arquivo demonstra como utilizar o cliente da API Stays
 * em diferentes cenários
 */

import StaysClient, { createStaysClient } from './stays-client';

/**
 * Exemplo 1: Criar cliente com modo MOCK
 */
async function exemploComMock() {
  console.log('=== Exemplo 1: Cliente com MOCK ===\n');

  const staysClient = new StaysClient(
    'test-client-id',
    'test-client-secret',
    'https://api.staysapp.com',
    true // Ativar MOCK
  );

  // Listar reservas
  const reservas = await staysClient.listReservations(10);
  console.log('Reservas:', JSON.stringify(reservas, null, 2));

  // Listar acomodações
  const acomodacoes = await staysClient.listAccommodations(10);
  console.log('\nAcomodações:', JSON.stringify(acomodacoes, null, 2));

  // Obter reservas atualizadas desde timestamp
  const reservasAtualizadas = await staysClient.getReservationUpdatedSince(
    '2025-10-21T00:00:00Z'
  );
  console.log('\nReservas atualizadas:', JSON.stringify(reservasAtualizadas, null, 2));
}

/**
 * Exemplo 2: Criar cliente a partir de variáveis de ambiente
 */
async function exemploComVariaveisAmbiente() {
  console.log('\n=== Exemplo 2: Cliente com variáveis de ambiente ===\n');

  const staysClient = createStaysClient();

  const config = staysClient.getConfig();
  console.log('Configuração do cliente:', config);
}

/**
 * Exemplo 3: Usar com paginação
 */
async function exemploComPaginacao() {
  console.log('\n=== Exemplo 3: Paginação ===\n');

  const staysClient = new StaysClient(
    'test-client-id',
    'test-client-secret',
    'https://api.staysapp.com',
    true
  );

  // Primeira página
  const pagina1 = await staysClient.listReservations(5, 0);
  console.log('Página 1:', JSON.stringify(pagina1, null, 2));

  // Segunda página
  const pagina2 = await staysClient.listReservations(5, 5);
  console.log('\nPágina 2:', JSON.stringify(pagina2, null, 2));
}

// Executar exemplos
(async () => {
  try {
    await exemploComMock();
    await exemploComVariaveisAmbiente();
    await exemploComPaginacao();
  } catch (error) {
    console.error('Erro nos exemplos:', error);
  }
})();
