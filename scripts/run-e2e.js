#!/usr/bin/env node

/**
 * PASSO 20 - Script de Execução da Simulação E2E
 *
 * Este script:
 * 1. Verifica pré-requisitos (PostgreSQL, Redis, API)
 * 2. Limpa banco de dados (opcional)
 * 3. Executa teste E2E
 * 4. Exibe relatório colorido
 */

const { spawn } = require('child_process');
const axios = require('axios');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function logInfo(msg) { log(colors.blue, `ℹ ${msg}`); }
function logSuccess(msg) { log(colors.green, `✓ ${msg}`); }
function logError(msg) { log(colors.red, `✗ ${msg}`); }
function logWarn(msg) { log(colors.yellow, `⚠ ${msg}`); }
function logStep(msg) { log(colors.cyan, `\n📍 ${msg}`); }

/**
 * Verificar se serviço está rodando
 */
async function checkService(name, url, timeout = 5000) {
  try {
    const response = await axios.get(url, { timeout });
    logSuccess(`${name} está rodando`);
    return true;
  } catch (error) {
    logError(`${name} não respondeu em ${url}`);
    return false;
  }
}

/**
 * Executar comando
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Main
 */
async function main() {
  log(colors.cyan, '\n═══════════════════════════════════════════════════════════');
  log(colors.cyan, '  PASSO 20 - Simulação E2E Completa');
  log(colors.cyan, '═══════════════════════════════════════════════════════════\n');

  try {
    // Pré-requisitos
    logStep('Verificando pré-requisitos...');

    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const dbUrl = process.env.DB_HOST || 'localhost';

    log(colors.blue, `API URL: ${apiUrl}`);
    log(colors.blue, `DB Host: ${dbUrl}`);
    log(colors.blue, `\nVerificando serviços...\n`);

    // Verificar API
    const apiRunning = await checkService('API', `${apiUrl}/api/health`);
    if (!apiRunning) {
      logWarn('API não respondeu - ela precisa estar rodando');
      logInfo('Execute em outro terminal: npm run dev');
    }

    // Verificar DB (opcional, apenas aviso)
    logInfo('Para verificar PostgreSQL: psql -U tuya_admin -d tuya_locks_db -c "SELECT 1"');

    // Verificar Redis (opcional)
    logInfo('Para verificar Redis: redis-cli ping');

    // Executar teste
    logStep('Executando teste E2E...\n');

    await runCommand('npm', ['run', 'test:e2e']);

    logStep('Teste concluído!');
    logSuccess('Simulação E2E completa executada com sucesso!\n');

  } catch (error) {
    logError(`Erro: ${error.message}`);
    process.exit(1);
  }
}

main();
