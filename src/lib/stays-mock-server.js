/**
 * Servidor Mock da API Stays
 * 
 * Simula endpoints da API Stays para testes locais
 * Porta: 3001
 * 
 * Endpoints:
 * - GET /v1/reservations?limit=50&offset=0
 * - GET /v1/accommodations?limit=50&offset=0
 * - GET /v1/reservations/updated-since?timestamp=ISO&limit=50
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

/**
 * Carregar dados mock dos arquivos JSON
 */
function loadMockData() {
  const reservationsPath = path.join(__dirname, '../../public/mocks/stays-reservations.json');
  const accommodationsPath = path.join(__dirname, '../../public/mocks/stays-accommodations.json');

  try {
    const reservationsData = fs.readFileSync(reservationsPath, 'utf-8');
    const accommodationsData = fs.readFileSync(accommodationsPath, 'utf-8');

    return {
      reservations: JSON.parse(reservationsData),
      accommodations: JSON.parse(accommodationsData),
    };
  } catch (error) {
    console.error('❌ Erro ao carregar dados mock:', error);
    throw new Error('Falha ao carregar fixtures de mock');
  }
}

/**
 * Inicializar servidor mock
 */
function createMockServer() {
  const app = express();
  const mockData = loadMockData();

  // Middleware
  app.use(express.json());

  // Logger customizado
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] 📡 ${req.method.toUpperCase()} ${req.path}`);

    if (Object.keys(req.query).length > 0) {
      console.log(`    Params:`, req.query);
    }

    res.on('finish', () => {
      console.log(`    Status: ${res.statusCode} ${res.statusMessage}`);
    });

    next();
  });

  // =========================================================================
  // Endpoint: GET /v1/reservations
  // =========================================================================
  app.get('/v1/reservations', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      // Validar
      if (limit <= 0 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: 'Invalid limit parameter (deve estar entre 1 e 100)',
          errorType: 'VALIDATION_ERROR',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      // Aplicar paginação
      const total = mockData.reservations.length;
      const paginatedData = mockData.reservations.slice(offset, offset + limit);
      const totalPages = Math.ceil(total / limit);

      const response = {
        success: true,
        data: paginatedData,
        statusCode: 200,
        timestamp: new Date().toISOString(),
        metadata: {
          total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
          totalPages,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('❌ Erro em /v1/reservations:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        errorType: 'SERVER_ERROR',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // =========================================================================
  // Endpoint: GET /v1/accommodations
  // =========================================================================
  app.get('/v1/accommodations', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      // Validar
      if (limit <= 0 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: 'Invalid limit parameter (deve estar entre 1 e 100)',
          errorType: 'VALIDATION_ERROR',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      // Aplicar paginação
      const total = mockData.accommodations.length;
      const paginatedData = mockData.accommodations.slice(offset, offset + limit);
      const totalPages = Math.ceil(total / limit);

      const response = {
        success: true,
        data: paginatedData,
        statusCode: 200,
        timestamp: new Date().toISOString(),
        metadata: {
          total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
          totalPages,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('❌ Erro em /v1/accommodations:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        errorType: 'SERVER_ERROR',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // =========================================================================
  // Endpoint: GET /v1/reservations/updated-since
  // =========================================================================
  app.get('/v1/reservations/updated-since', (req, res) => {
    try {
      const timestamp = req.query.timestamp;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      // Validar timestamp
      if (!timestamp) {
        return res.status(400).json({
          success: false,
          error: 'timestamp parameter é obrigatório',
          errorType: 'VALIDATION_ERROR',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      // Validar timestamp é ISO string válida
      try {
        new Date(timestamp).toISOString();
      } catch {
        return res.status(400).json({
          success: false,
          error: 'timestamp deve ser uma data válida em formato ISO',
          errorType: 'VALIDATION_ERROR',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      // Filtrar por timestamp
      const timestampDate = new Date(timestamp);
      const filtered = mockData.reservations.filter((res) => {
        const resUpdatedAt = new Date(res.updatedAt);
        return resUpdatedAt >= timestampDate;
      });

      // Aplicar paginação
      const total = filtered.length;
      const paginatedData = filtered.slice(offset, offset + limit);
      const totalPages = Math.ceil(total / limit);

      const response = {
        success: true,
        data: paginatedData,
        statusCode: 200,
        timestamp: new Date().toISOString(),
        metadata: {
          total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
          totalPages,
          filteredSince: timestamp,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('❌ Erro em /v1/reservations/updated-since:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        errorType: 'SERVER_ERROR',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // =========================================================================
  // Endpoint: GET /health
  // =========================================================================
  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint não encontrado',
      path: req.path,
      statusCode: 404,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

/**
 * Iniciar servidor mock
 */
async function startMockServer(port = 3001) {
  try {
    const app = createMockServer();

    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║  🟢 Mock Stays API Server Iniciado                    ║
║                                                        ║
║  Porta: ${port}                                             ║
║  URL: http://localhost:${port}                        ║
║                                                        ║
║  Endpoints disponíveis:                              ║
║  • GET /v1/reservations                              ║
║  • GET /v1/accommodations                            ║
║  • GET /v1/reservations/updated-since                ║
║  • GET /health                                       ║
║                                                        ║
║  Pressione Ctrl+C para parar                         ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Parando servidor...');
      server.close(() => {
        console.log('✅ Servidor parado');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor mock:', error);
    process.exit(1);
  }
}

// Executar se for arquivo principal
if (require.main === module) {
  const port = parseInt(process.env.MOCK_PORT || '3001');
  startMockServer(port);
}

module.exports = { createMockServer, startMockServer };
