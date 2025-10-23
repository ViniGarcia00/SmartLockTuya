import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * Interface para resposta de reservas do Stays
 */
export interface StaysReservation {
  id: string;
  accommodationId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  lockCode?: string;
}

/**
 * Interface para acomodações do Stays
 */
export interface StaysAccommodation {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interface para resposta da API Stays
 */
export interface StaysResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Classe cliente para integração com API Stays
 * 
 * Suporta:
 * - Autenticação Basic (client_id:client_secret)
 * - Timeout de 10 segundos
 * - Retry automático com 3 tentativas
 * - Modo MOCK para testes (STAYS_ENABLE_MOCK=true)
 */
export class StaysClient {
  private axiosInstance: AxiosInstance;
  private clientId: string;
  private clientSecret: string;
  private enableMock: boolean;
  private baseURL: string;
  private readonly TIMEOUT = 10000; // 10 segundos
  private readonly MAX_RETRIES = 3;

  /**
   * Construtor do cliente Stays
   * @param clientId - ID do cliente Stays
   * @param clientSecret - Secret do cliente Stays
   * @param baseURL - URL base da API Stays (padrão: https://api.staysapp.com)
   * @param enableMock - Ativar modo MOCK para testes
   */
  constructor(
    clientId: string,
    clientSecret: string,
    baseURL: string = 'https://api.staysapp.com',
    enableMock: boolean = false
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseURL = baseURL;
    this.enableMock = enableMock || process.env.STAYS_ENABLE_MOCK === 'true';

    // Configurar instância axios
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: this.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartLockTuya/1.0',
      },
    });

    // Interceptor para adicionar autenticação Basic
    this.axiosInstance.interceptors.request.use((config) => {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      config.headers.Authorization = `Basic ${credentials}`;
      return config;
    });

    // Interceptor para log e tratamento de erros
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error(`[StaysClient] Erro na requisição: ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Executar requisição com retry automático
   * @param fn - Função que executa a requisição
   * @returns Promise com resultado
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(
          `[StaysClient] Retry ${retryCount + 1}/${this.MAX_RETRIES} após ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.executeWithRetry(fn, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Obter lista de reservas
   * @param limit - Quantidade de reservas (padrão: 100)
   * @param offset - Offset para paginação (padrão: 0)
   * @returns Lista de reservas
   */
  async listReservations(
    limit: number = 100,
    offset: number = 0
  ): Promise<StaysResponse<StaysReservation[]>> {
    // Modo MOCK
    if (this.enableMock) {
      return this.getMockReservations(limit, offset);
    }

    try {
      const result = await this.executeWithRetry(async () => {
        const response = await this.axiosInstance.get<StaysReservation[]>(
          '/v1/reservations',
          {
            params: {
              limit,
              offset,
            },
          }
        );
        return response.data;
      });

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof AxiosError
        ? error.response?.data?.message || error.message
        : String(error);

      console.error('[StaysClient] Erro ao listar reservas:', errorMessage);

      return {
        success: false,
        error: `Falha ao listar reservas: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Obter lista de acomodações
   * @param limit - Quantidade de acomodações (padrão: 100)
   * @param offset - Offset para paginação (padrão: 0)
   * @returns Lista de acomodações
   */
  async listAccommodations(
    limit: number = 100,
    offset: number = 0
  ): Promise<StaysResponse<StaysAccommodation[]>> {
    // Modo MOCK
    if (this.enableMock) {
      return this.getMockAccommodations(limit, offset);
    }

    try {
      const result = await this.executeWithRetry(async () => {
        const response = await this.axiosInstance.get<StaysAccommodation[]>(
          '/v1/accommodations',
          {
            params: {
              limit,
              offset,
            },
          }
        );
        return response.data;
      });

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof AxiosError
        ? error.response?.data?.message || error.message
        : String(error);

      console.error('[StaysClient] Erro ao listar acomodações:', errorMessage);

      return {
        success: false,
        error: `Falha ao listar acomodações: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Obter reservas atualizadas desde um timestamp
   * @param timestamp - Timestamp ISO string
   * @param limit - Quantidade de reservas (padrão: 100)
   * @returns Lista de reservas atualizadas
   */
  async getReservationUpdatedSince(
    timestamp: string,
    limit: number = 100
  ): Promise<StaysResponse<StaysReservation[]>> {
    // Validar timestamp
    if (!this.isValidISO8601(timestamp)) {
      return {
        success: false,
        error: 'Timestamp inválido. Use formato ISO 8601 (ex: 2025-10-23T00:00:00Z)',
        timestamp: new Date().toISOString(),
      };
    }

    // Modo MOCK
    if (this.enableMock) {
      return this.getMockReservationsUpdatedSince(timestamp, limit);
    }

    try {
      const result = await this.executeWithRetry(async () => {
        const response = await this.axiosInstance.get<StaysReservation[]>(
          '/v1/reservations/updated-since',
          {
            params: {
              timestamp,
              limit,
            },
          }
        );
        return response.data;
      });

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof AxiosError
        ? error.response?.data?.message || error.message
        : String(error);

      console.error('[StaysClient] Erro ao obter reservas atualizadas:', errorMessage);

      return {
        success: false,
        error: `Falha ao obter reservas atualizadas: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Validar formato ISO 8601
   */
  private isValidISO8601(timestamp: string): boolean {
    try {
      const date = new Date(timestamp);
      return !isNaN(date.getTime()) && timestamp === date.toISOString();
    } catch {
      return false;
    }
  }

  /**
   * Retornar dados fake de reservas para modo MOCK
   */
  private getMockReservations(
    limit: number,
    offset: number
  ): Promise<StaysResponse<StaysReservation[]>> {
    const mockData: StaysReservation[] = [
      {
        id: 'RES-001',
        accommodationId: 'ACC-001',
        guestName: 'João Silva',
        checkInDate: '2025-10-24',
        checkOutDate: '2025-10-27',
        status: 'confirmed' as const,
        createdAt: '2025-10-20T10:00:00Z',
        updatedAt: '2025-10-20T10:00:00Z',
        lockCode: '1234567',
      },
      {
        id: 'RES-002',
        accommodationId: 'ACC-002',
        guestName: 'Maria Santos',
        checkInDate: '2025-10-25',
        checkOutDate: '2025-10-28',
        status: 'pending' as const,
        createdAt: '2025-10-21T14:30:00Z',
        updatedAt: '2025-10-21T14:30:00Z',
      },
      {
        id: 'RES-003',
        accommodationId: 'ACC-001',
        guestName: 'Pedro Costa',
        checkInDate: '2025-10-29',
        checkOutDate: '2025-11-02',
        status: 'confirmed' as const,
        createdAt: '2025-10-22T09:15:00Z',
        updatedAt: '2025-10-22T09:15:00Z',
        lockCode: '7654321',
      },
    ].slice(offset, offset + limit);

    console.log(`[StaysClient - MOCK] Retornando ${mockData.length} reservas`);

    return Promise.resolve({
      success: true,
      data: mockData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Retornar dados fake de acomodações para modo MOCK
   */
  private getMockAccommodations(
    limit: number,
    offset: number
  ): Promise<StaysResponse<StaysAccommodation[]>> {
    const mockData: StaysAccommodation[] = [
      {
        id: 'ACC-001',
        name: 'Apartamento Centro',
        address: 'Rua Principal, 123',
        city: 'São Paulo',
        country: 'Brasil',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-10-20T00:00:00Z',
      },
      {
        id: 'ACC-002',
        name: 'Casa Praia',
        address: 'Avenida Costaneira, 456',
        city: 'Salvador',
        country: 'Brasil',
        createdAt: '2025-02-15T00:00:00Z',
        updatedAt: '2025-10-19T00:00:00Z',
      },
      {
        id: 'ACC-003',
        name: 'Studio Moderno',
        address: 'Rua dos Artistas, 789',
        city: 'Rio de Janeiro',
        country: 'Brasil',
        createdAt: '2025-03-10T00:00:00Z',
        updatedAt: '2025-10-21T00:00:00Z',
      },
    ].slice(offset, offset + limit);

    console.log(`[StaysClient - MOCK] Retornando ${mockData.length} acomodações`);

    return Promise.resolve({
      success: true,
      data: mockData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Retornar dados fake de reservas atualizadas para modo MOCK
   */
  private getMockReservationsUpdatedSince(
    timestamp: string,
    limit: number
  ): Promise<StaysResponse<StaysReservation[]>> {
    const sinceDate = new Date(timestamp);
    
    const mockData: StaysReservation[] = [
      {
        id: 'RES-002',
        accommodationId: 'ACC-002',
        guestName: 'Maria Santos',
        checkInDate: '2025-10-25',
        checkOutDate: '2025-10-28',
        status: 'pending' as const,
        createdAt: '2025-10-21T14:30:00Z',
        updatedAt: '2025-10-21T14:30:00Z',
      },
      {
        id: 'RES-003',
        accommodationId: 'ACC-001',
        guestName: 'Pedro Costa',
        checkInDate: '2025-10-29',
        checkOutDate: '2025-11-02',
        status: 'confirmed' as const,
        createdAt: '2025-10-22T09:15:00Z',
        updatedAt: '2025-10-22T09:15:00Z',
        lockCode: '7654321',
      },
    ]
      .filter((res) => new Date(res.updatedAt) >= sinceDate)
      .slice(0, limit);

    console.log(
      `[StaysClient - MOCK] Retornando ${mockData.length} reservas atualizadas desde ${timestamp}`
    );

    return Promise.resolve({
      success: true,
      data: mockData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Obter configuração atual do cliente
   */
  getConfig() {
    return {
      clientId: this.clientId,
      baseURL: this.baseURL,
      timeout: this.TIMEOUT,
      maxRetries: this.MAX_RETRIES,
      enableMock: this.enableMock,
    };
  }
}

// Exportar factory para criar instância
export function createStaysClient(
  clientId?: string,
  clientSecret?: string,
  baseURL?: string,
  enableMock?: boolean
): StaysClient {
  const id = clientId || process.env.STAYS_CLIENT_ID || 'default-client';
  const secret = clientSecret || process.env.STAYS_CLIENT_SECRET || 'default-secret';
  const url = baseURL || process.env.STAYS_API_URL || 'https://api.staysapp.com';
  const mock = enableMock !== undefined ? enableMock : process.env.STAYS_ENABLE_MOCK === 'true';

  return new StaysClient(id, secret, url, mock);
}

export default StaysClient;
