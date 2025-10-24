/**
 * Testes para Mapping Service
 * 
 * Testa:
 * - Mapeamento 1:1 válido
 * - Rejeição de mapeamento duplicado (lock já mapeado)
 * - Desmapeamento
 * - Atualização de mapeamento
 */

const request = require('supertest');
const express = require('express');

// Mock do database
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

// Mock do middleware de autenticação
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-123' };
    next();
  },
  logActivity: jest.fn(),
}));

const { query } = require('../config/database');
const mappingsRouter = require('../routes/mappings');

// Criar app Express para testes
const app = express();
app.use(express.json());
app.use('/api/admin/mappings', mappingsRouter);

describe('Mappings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ======================================================================
  // TESTE 1: Mapeamento 1:1 válido
  // ======================================================================
  describe('POST /api/admin/mappings - Mapeamento Válido', () => {
    it('deve mapear uma acomodação a uma fechadura com sucesso', async () => {
      // Mock: acomodação existe
      query.mockResolvedValueOnce({
        rows: [{ id: 'accom-001' }],
      });

      // Mock: fechadura existe
      query.mockResolvedValueOnce({
        rows: [{ id: 'lock-001' }],
      });

      // Mock: fechadura não está mapeada para outra acomodação
      query.mockResolvedValueOnce({
        rows: [],
      });

      // Mock: nenhum mapeamento existente para essa acomodação
      query.mockResolvedValueOnce({
        rows: [],
      });

      // Mock: criar novo mapeamento
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'map-001',
            accommodation_id: 'accom-001',
            lock_id: 'lock-001',
            created_by: 'test-user-123',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const response = await request(app)
        .post('/api/admin/mappings')
        .send({
          accommodationId: 'accom-001',
          lockId: 'lock-001',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Fechadura mapeada com sucesso',
        mapping: expect.objectContaining({
          id: 'map-001',
          accommodationId: 'accom-001',
          lockId: 'lock-001',
          createdBy: 'test-user-123',
        }),
      });

      expect(query).toHaveBeenCalledTimes(5);
    });

    it('deve retornar erro se acomodação não existe', async () => {
      // Mock: acomodação não existe
      query.mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .post('/api/admin/mappings')
        .send({
          accommodationId: 'accom-invalid',
          lockId: 'lock-001',
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: expect.stringContaining('Acomodação com ID'),
      });
    });

    it('deve retornar erro se fechadura não existe', async () => {
      // Mock: acomodação existe
      query.mockResolvedValueOnce({
        rows: [{ id: 'accom-001' }],
      });

      // Mock: fechadura não existe
      query.mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .post('/api/admin/mappings')
        .send({
          accommodationId: 'accom-001',
          lockId: 'lock-invalid',
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: expect.stringContaining('Fechadura com ID'),
      });
    });
  });

  // ======================================================================
  // TESTE 2: Rejeição de mapeamento duplicado
  // ======================================================================
  describe('POST /api/admin/mappings - Rejeição de Duplicado', () => {
    it('deve rejeitar mapeamento se lock já está vinculado a outra acomodação', async () => {
      // Mock: acomodação existe
      query.mockResolvedValueOnce({
        rows: [{ id: 'accom-001' }],
      });

      // Mock: fechadura existe
      query.mockResolvedValueOnce({
        rows: [{ id: 'lock-001' }],
      });

      // Mock: fechadura já está mapeada para OUTRA acomodação
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'map-existing',
            accommodation_id: 'accom-002', // Outra acomodação
            lock_id: 'lock-001',
          },
        ],
      });

      const response = await request(app)
        .post('/api/admin/mappings')
        .send({
          accommodationId: 'accom-001',
          lockId: 'lock-001',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: expect.stringContaining('Fechadura já está mapeada'),
      });

      expect(response.body.error).toContain('accom-002');
    });

    it('deve permitir remapear a mesma fechadura se for para a mesma acomodação', async () => {
      // Mock: acomodação existe
      query.mockResolvedValueOnce({
        rows: [{ id: 'accom-001' }],
      });

      // Mock: fechadura existe
      query.mockResolvedValueOnce({
        rows: [{ id: 'lock-001' }],
      });

      // Mock: nenhum conflito (lock não está mapeado para outra acomodação)
      query.mockResolvedValueOnce({
        rows: [],
      });

      // Mock: mapeamento existente para mesma acomodação
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'map-001',
            accommodation_id: 'accom-001',
            lock_id: 'lock-001',
          },
        ],
      });

      // Mock: atualizar mapeamento
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'map-001',
            accommodation_id: 'accom-001',
            lock_id: 'lock-001',
            created_by: 'test-user-123',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const response = await request(app)
        .post('/api/admin/mappings')
        .send({
          accommodationId: 'accom-001',
          lockId: 'lock-001',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ======================================================================
  // TESTE 3: Desmapeamento
  // ======================================================================
  describe('POST /api/admin/mappings - Desmapeamento (lockId=null)', () => {
    it('deve desmapar uma acomodação quando lockId é null', async () => {
      // Mock: acomodação existe
      query.mockResolvedValueOnce({
        rows: [{ id: 'accom-001' }],
      });

      // Mock: mapeamento existe
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'map-001',
            accommodation_id: 'accom-001',
            lock_id: 'lock-001',
            created_by: 'test-user-123',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock: deletar mapeamento
      query.mockResolvedValueOnce({
        rows: [{ success: true }],
      });

      const response = await request(app)
        .post('/api/admin/mappings')
        .send({
          accommodationId: 'accom-001',
          lockId: null,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Fechadura desmapeada com sucesso',
        mapping: expect.objectContaining({
          accommodationId: 'accom-001',
          lockId: 'lock-001',
        }),
      });
    });

    it('deve retornar erro ao tentar desmapar acomodação sem mapeamento', async () => {
      // Mock: acomodação existe
      query.mockResolvedValueOnce({
        rows: [{ id: 'accom-001' }],
      });

      // Mock: nenhum mapeamento encontrado
      query.mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .post('/api/admin/mappings')
        .send({
          accommodationId: 'accom-001',
          lockId: null,
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: expect.stringContaining('Nenhum mapeamento encontrado'),
      });
    });
  });

  // ======================================================================
  // TESTE 4: GET Mapeamentos
  // ======================================================================
  describe('GET /api/admin/mappings - Listar Mapeamentos', () => {
    it('deve retornar todos os mapeamentos com dados relacionados', async () => {
      // Mock: query retorna mapeamentos com dados da acomodação e fechadura
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'map-001',
            accommodation_id: 'accom-001',
            lock_id: 'lock-001',
            accommodation_name: 'Suite Master',
            accommodation_status: 'ACTIVE',
            lock_alias: 'Fechadura Principal',
            device_id: 'device-123',
            vendor: 'TUYA',
            created_by: 'admin',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'map-002',
            accommodation_id: 'accom-002',
            lock_id: 'lock-002',
            accommodation_name: 'Suite Presidencial',
            accommodation_status: 'ACTIVE',
            lock_alias: 'Fechadura VIP',
            device_id: 'device-456',
            vendor: 'TUYA',
            created_by: 'admin',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const response = await request(app).get('/api/admin/mappings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.mappings).toHaveLength(2);
      expect(response.body.mappings[0]).toEqual(
        expect.objectContaining({
          accommodationId: 'accom-001',
          lockId: 'lock-001',
          accommodation: expect.objectContaining({
            name: 'Suite Master',
          }),
          lock: expect.objectContaining({
            alias: 'Fechadura Principal',
          }),
        })
      );
    });
  });

  // ======================================================================
  // TESTE 5: DELETE Mapeamento
  // ======================================================================
  describe('DELETE /api/admin/mappings/:accommodationId', () => {
    it('deve deletar um mapeamento específico', async () => {
      // Mock: mapeamento existe
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'map-001',
            accommodation_id: 'accom-001',
            lock_id: 'lock-001',
            created_by: 'admin',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock: deletar mapeamento
      query.mockResolvedValueOnce({
        rows: [{ success: true }],
      });

      const response = await request(app).delete(
        '/api/admin/mappings/accom-001'
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Mapeamento deletado com sucesso',
        mapping: expect.objectContaining({
          accommodationId: 'accom-001',
          lockId: 'lock-001',
        }),
      });
    });

    it('deve retornar erro ao tentar deletar mapeamento inexistente', async () => {
      // Mock: nenhum mapeamento encontrado
      query.mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app).delete(
        '/api/admin/mappings/accom-invalid'
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: expect.stringContaining('Nenhum mapeamento encontrado'),
      });
    });
  });

  // ======================================================================
  // TESTE 6: Validação de Input
  // ======================================================================
  describe('POST /api/admin/mappings - Validação de Input', () => {
    it('deve retornar erro se accommodationId está faltando', async () => {
      const response = await request(app).post('/api/admin/mappings').send({
        lockId: 'lock-001',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'accommodationId é obrigatório',
      });
    });
  });
});
