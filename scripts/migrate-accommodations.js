/**
 * Script de Migração: Adicionar tabelas de Acomodações
 * 
 * Cria as tabelas necessárias para o PASSO 12:
 * - accommodations
 * - locks
 * - accommodation_lock_mappings
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require(require('path').join(__dirname, '../config/database'));

async function runMigration() {
  console.log('\n🔄 Iniciando migração de acomodações...\n');

  try {
    // 1. Criar tabela accommodations
    console.log('📝 Criando tabela accommodations...');
    await query(`
      CREATE TABLE IF NOT EXISTS accommodations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela accommodations criada');

    // 2. Criar índices para accommodations
    console.log('📝 Criando índices para accommodations...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_accommodations_status 
      ON accommodations(status)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_accommodations_name 
      ON accommodations(name)
    `);
    console.log('✅ Índices criados');

    // 3. Criar tabela locks (se não existir)
    console.log('📝 Criando tabela locks...');
    await query(`
      CREATE TABLE IF NOT EXISTS locks (
        id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        device_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabela locks criada');

    // 4. Criar índices para locks
    console.log('📝 Criando índices para locks...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_locks_user_id 
      ON locks(user_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_locks_device_id 
      ON locks(device_id)
    `);
    console.log('✅ Índices criados');

    // 5. Criar tabela accommodation_lock_mappings
    console.log('📝 Criando tabela accommodation_lock_mappings...');
    await query(`
      CREATE TABLE IF NOT EXISTS accommodation_lock_mappings (
        id SERIAL PRIMARY KEY,
        accommodation_id VARCHAR(255) NOT NULL UNIQUE,
        lock_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (accommodation_id) REFERENCES accommodations(id) ON DELETE CASCADE,
        FOREIGN KEY (lock_id) REFERENCES locks(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabela accommodation_lock_mappings criada');

    // 6. Criar índices para mapeamentos
    console.log('📝 Criando índices para mapeamentos...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_mappings_accommodation 
      ON accommodation_lock_mappings(accommodation_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_mappings_lock 
      ON accommodation_lock_mappings(lock_id)
    `);
    console.log('✅ Índices criados');

    console.log('\n✅ Migração concluída com sucesso!\n');
    console.log('Tabelas criadas:');
    console.log('  ✓ accommodations');
    console.log('  ✓ locks');
    console.log('  ✓ accommodation_lock_mappings');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erro durante a migração:', error.message);
    console.error('');
    process.exit(1);
  }
}

runMigration();
