require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

console.log('🔍 Testando conexão com PostgreSQL...\n');
console.log('Configurações:');
console.log(`Host: ${process.env.DB_HOST}`);
console.log(`Port: ${process.env.DB_PORT || 5432}`);
console.log(`Database: ${process.env.DB_NAME}`);
console.log(`User: ${process.env.DB_USER}`);
console.log(`Password: ${process.env.DB_PASSWORD ? '***' : 'NÃO CONFIGURADA'}\n`);

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ ERRO ao conectar:');
    console.error(err.message);
    console.error('\n💡 Verifique:');
    console.error('1. PostgreSQL está rodando?');
    console.error('2. Credenciais no .env estão corretas?');
    console.error('3. Banco de dados existe?');
  } else {
    console.log('✅ CONEXÃO BEM-SUCEDIDA!');
    console.log(`📅 Data/Hora do servidor: ${res.rows[0].now}`);
    
    // Testa se tabelas existem
    pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `, (err2, res2) => {
      if (!err2) {
        console.log(`\n📊 Tabelas encontradas: ${res2.rows.length}`);
        res2.rows.forEach(row => {
          console.log(`   ✓ ${row.tablename}`);
        });
      }
      pool.end();
    });
  }
});