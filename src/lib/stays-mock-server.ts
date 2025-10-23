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

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';

// Tipos
import type {
  Reservation,
  Accommodation,
  StaysApiResponse,
} from './stays.types';

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
      reservations: JSON.parse(reservationsData) as Reservation[],
      accommodations: JSON.parse(accommodationsData) as Accommodation[],
    };
  } catch (error) {
    console.error('❌ Erro ao carregar dados mock:', error);
    throw new Error('Falha ao carregar fixtures de mock');
  }
}

/**
 * Inicializar servidor mock
 */
export function createMockServer() {
  const app = express();
  const mockData = loadMockData();

  // Middleware
  app.use(express.json());

  // Logger customizado
  app.use((req: Request, res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] 📡 ${req.method.toUpperCase()} ${req.originalUrl}`);

    if (Object.keys(req.query).length > 0) {
      console.log(`    Params:`, req.query);
    }

    res.on('finish', () => {
      console.log(`    Status: ${res.statusCode}`);
    });

    next();
  });

  // =========================================================================
  // Endpoint: GET /v1/reservations
  // =========================================================================
  app.get('/v1/reservations', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // Validar
      if (limit <= 0 || limit > 100) {
        return res
          .status(400)
          .json({
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

      const response: StaysApiResponse<Reservation[]> = {
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

      console.log(`    ✅ Retornando ${paginatedData.length}/${total} reservas`);
      res
        .status(200)
        .json(response);
    } catch (error) {
      console.error('    ❌ Erro:', error);
      res
        .status(500)
        .json({
          success: false,
          error: 'Internal server error',
          errorType: 'UNKNOWN_ERROR',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
    }
  });

  // =========================================================================
  // Endpoint: GET /v1/accommodations
  // =========================================================================
  app.get('/v1/accommodations', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // Validar
      if (limit <= 0 || limit > 100) {
        return res
          .status(400)
          .json({
            success: false,
            error: 'Invalid limit parameter',
            errorType: 'VALIDATION_ERROR',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
      }

      // Aplicar paginação
      const total = mockData.accommodations.length;
      const paginatedData = mockData.accommodations.slice(offset, offset + limit);
      const totalPages = Math.ceil(total / limit);

      const response: StaysApiResponse<Accommodation[]> = {
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

      console.log(`    ✅ Retornando ${paginatedData.length}/${total} acomodações`);
      res
        .status(200)
        .json(response);
    } catch (error) {
      console.error('    ❌ Erro:', error);
      res
        .status(500)
        .json({
          success: false,
          error: 'Internal server error',
          errorType: 'UNKNOWN_ERROR',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
    }
  });

  // =========================================================================
  // Endpoint: GET /v1/reservations/updated-since
  // =========================================================================
  app.get('/v1/reservations/updated-since', (req: Request, res: Response) => {
    try {
      const timestamp = req.query.timestamp as string;
      const limit = parseInt(req.query.limit as string) || 50;

      // Validar timestamp
      if (!timestamp) {
        return res
          .status(400)
          .json({
            success: false,
            error: 'Missing required parameter: timestamp',
            errorType: 'VALIDATION_ERROR',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
      }

      // Tentar parseá-lo
      const sinceDate = new Date(timestamp);
      if (isNaN(sinceDate.getTime())) {
        return res
          .status(400)
          .json({
            success: false,
            error: 'Invalid timestamp format. Use ISO 8601 (ex: 2025-10-23T00:00:00Z)',
            errorType: 'VALIDATION_ERROR',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
      }

      // Filtrar por timestamp
      const filteredData = mockData.reservations
        .filter((res) => new Date(res.updatedAt) >= sinceDate)
        .slice(0, limit);

      const response: StaysApiResponse<Reservation[]> = {
        success: true,
        data: filteredData,
        statusCode: 200,
        timestamp: new Date().toISOString(),
        metadata: {
          total: filteredData.length,
        },
      };

      console.log(`    ✅ Retornando ${filteredData.length} reservas atualizadas desde ${timestamp}`);
      res
        .status(200)
        .json(response);
    } catch (error) {
      console.error('    ❌ Erro:', error);
      res
        .status(500)
        .json({
          success: false,
          error: 'Internal server error',
          errorType: 'UNKNOWN_ERROR',
          statusCode: 500,
          timestamp: new Date().toISOString(),
      });
    }
  });

  // =========================================================================
  // Health Check
  // =========================================================================
  app.get('/health', (req: Request, res: Response) => {
    res
      .status(200)
      .json({
        status: 'ok',
        message: 'Mock Stays API Server is running',
        timestamp: new Date().toISOString(),
        endpoints: [
          'GET /v1/reservations?limit=50&offset=0',
          'GET /v1/accommodations?limit=50&offset=0',
          'GET /v1/reservations/updated-since?timestamp=ISO&limit=50',
          'GET /health',
        ],
      });
  });

  // =========================================================================
  // 404 Handler
  // =========================================================================
  app.use((req: Request, res: Response) => {
    console.log(`    ⚠️  Endpoint não encontrado`);
    res
      .status(404)
      .json({
        success: false,
        error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
        errorType: 'NOT_FOUND',
      statusCode: 404,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

/**
 * Iniciar servidor mock
 */
export async function startMockServer(port: number = 3001) {
  try {
    const app = createMockServer();

    app.listen(port, () => {
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

export default createMockServer;
