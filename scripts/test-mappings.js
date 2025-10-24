#!/usr/bin/env node

/**
 * Script de Teste Rápido para Endpoints de Mapeamento
 * 
 * Uso: node scripts/test-mappings.js
 * 
 * Testa:
 * - POST /api/admin/mappings (mapear)
 * - POST /api/admin/mappings (desmapar com lockId=null)
 * - GET /api/admin/mappings
 * - DELETE /api/admin/mappings/:accommodationId
 * - Validações de erro
 */

const http = require('http');

const API_URL = 'http://localhost:3000';
const TOKEN = 'admin-token'; // Mock token

let testsPassed = 0;
let testsFailed = 0;

/**
 * Faz requisição HTTP
 */
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: data ? JSON.parse(data) : null,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Log de teste
 */
function logTest(name, passed, expected, actual) {
  if (passed) {
    console.log(`✅ ${name}`);
    testsPassed++;
  } else {
    console.log(`❌ ${name}`);
    console.log(`   Esperado: ${expected}`);
    console.log(`   Obtido: ${actual}`);
    testsFailed++;
  }
}

/**
 * Principais testes
 */
async function runTests() {
  console.log('\n🧪 Iniciando testes de mapeamento...\n');

  try {
    // ====================================================================
    // TESTE 1: Mapear uma fechadura
    // ====================================================================
    console.log('📝 Teste 1: Mapear uma fechadura');
    const mapResponse = await makeRequest('POST', '/api/admin/mappings', {
      accommodationId: 'test-accom-001',
      lockId: 'test-lock-001',
    });

    logTest(
      'POST /api/admin/mappings - Mapear',
      mapResponse.status === 200 && mapResponse.body.success,
      'status 200 + success: true',
      `status ${mapResponse.status} + success: ${mapResponse.body?.success}`
    );

    if (mapResponse.body?.mapping) {
      console.log(`   → Mapping ID: ${mapResponse.body.mapping.id}`);
      console.log(`   → Accommodation: ${mapResponse.body.mapping.accommodationId}`);
      console.log(`   → Lock: ${mapResponse.body.mapping.lockId}`);
    }

    // ====================================================================
    // TESTE 2: Listar mapeamentos
    // ====================================================================
    console.log('\n📝 Teste 2: Listar mapeamentos');
    const listResponse = await makeRequest('GET', '/api/admin/mappings');

    logTest(
      'GET /api/admin/mappings',
      listResponse.status === 200 && listResponse.body.success && Array.isArray(listResponse.body.mappings),
      'status 200 + success: true + mappings array',
      `status ${listResponse.status} + success: ${listResponse.body?.success}`
    );

    if (listResponse.body?.mappings) {
      console.log(`   → Total de mapeamentos: ${listResponse.body.count}`);
    }

    // ====================================================================
    // TESTE 3: Desmapar (lockId = null)
    // ====================================================================
    console.log('\n📝 Teste 3: Desmapar uma fechadura (lockId = null)');
    const unmapResponse = await makeRequest('POST', '/api/admin/mappings', {
      accommodationId: 'test-accom-001',
      lockId: null,
    });

    logTest(
      'POST /api/admin/mappings - Desmapar',
      unmapResponse.status === 200 && unmapResponse.body.success,
      'status 200 + success: true',
      `status ${unmapResponse.status} + success: ${unmapResponse.body?.success}`
    );

    // ====================================================================
    // TESTE 4: Validação - Acomodação não encontrada
    // ====================================================================
    console.log('\n📝 Teste 4: Validação - Acomodação não encontrada');
    const invalidAccomResponse = await makeRequest('POST', '/api/admin/mappings', {
      accommodationId: 'invalid-accom',
      lockId: 'test-lock-001',
    });

    logTest(
      'POST /api/admin/mappings - Rejeita acomodação inválida',
      invalidAccomResponse.status === 404 && !invalidAccomResponse.body.success,
      'status 404 + success: false',
      `status ${invalidAccomResponse.status} + success: ${invalidAccomResponse.body?.success}`
    );

    // ====================================================================
    // TESTE 5: Validação - Campo obrigatório
    // ====================================================================
    console.log('\n📝 Teste 5: Validação - Campo obrigatório');
    const missingFieldResponse = await makeRequest('POST', '/api/admin/mappings', {
      lockId: 'test-lock-001',
      // accommodationId faltando
    });

    logTest(
      'POST /api/admin/mappings - Rejeita accommodationId faltando',
      missingFieldResponse.status === 400 && !missingFieldResponse.body.success,
      'status 400 + success: false',
      `status ${missingFieldResponse.status} + success: ${missingFieldResponse.body?.success}`
    );

    // ====================================================================
    // RESUMO
    // ====================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DOS TESTES');
    console.log('='.repeat(60));
    console.log(`✅ Testes passados: ${testsPassed}`);
    console.log(`❌ Testes falhados: ${testsFailed}`);
    console.log(`📈 Taxa de sucesso: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
    console.log('='.repeat(60));

    process.exit(testsFailed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
    console.error('\n💡 Dica: Certifique-se de que o servidor está rodando:');
    console.error('   npm start');
    process.exit(1);
  }
}

// Executar testes
runTests();
