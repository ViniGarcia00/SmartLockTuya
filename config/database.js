const { Pool } = require('pg');

// Configuração do Pool de conexões PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tuya_locks_db',
  user: process.env.DB_USER || 'tuya_admin',
  password: process.env.DB_PASSWORD,
  max: 20, // máximo de clientes no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Testa a conexão
pool.on('connect', () => {
  console.log('Conectado ao banco de dados PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Erro no pool PostgreSQL:', err);
  process.exit(-1);
});

// Função auxiliar para executar queries
const query = async (text, params) => {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    console.error('Erro na query:', error.message);
    throw error;
  }
};

// Função para transações
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  transaction
};