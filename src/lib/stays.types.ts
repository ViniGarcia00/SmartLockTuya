/**
 * Tipos para integração com Stays
 * Define as interfaces e tipos utilizados pela API Stays
 */

/**
 * Status possíveis de uma reserva
 */
export type ReservationStatus = 'confirmed' | 'pending' | 'cancelled' | 'checked-in' | 'checked-out';

/**
 * Informações de uma reserva no Stays
 */
export interface Reservation {
  /** ID único da reserva */
  id: string;

  /** ID da acomodação */
  accommodationId: string;

  /** Nome do hóspede */
  guestName: string;

  /** Email do hóspede */
  guestEmail?: string;

  /** Telefone do hóspede */
  guestPhone?: string;

  /** Data de check-in (formato: YYYY-MM-DD) */
  checkInDate: string;

  /** Data de check-out (formato: YYYY-MM-DD) */
  checkOutDate: string;

  /** Status da reserva */
  status: ReservationStatus;

  /** Número de hóspedes */
  numberOfGuests?: number;

  /** Código gerado para acesso à fechadura */
  lockCode?: string;

  /** Observações adicionais */
  notes?: string;

  /** Data de criação (ISO 8601) */
  createdAt: string;

  /** Data de última atualização (ISO 8601) */
  updatedAt: string;

  /** ID externo (opcional) */
  externalId?: string;

  /** Valor da reserva */
  totalPrice?: number;

  /** Moeda da reserva */
  currency?: string;
}

/**
 * Informações de uma acomodação no Stays
 */
export interface Accommodation {
  /** ID único da acomodação */
  id: string;

  /** Nome da acomodação */
  name: string;

  /** Descrição da acomodação */
  description?: string;

  /** Endereço */
  address: string;

  /** Número do endereço */
  addressNumber?: string;

  /** Complemento do endereço */
  addressComplement?: string;

  /** Bairro */
  neighborhood?: string;

  /** Cidade */
  city: string;

  /** Estado/Província */
  state?: string;

  /** CEP/Código postal */
  postalCode?: string;

  /** País */
  country: string;

  /** Coordenadas de latitude */
  latitude?: number;

  /** Coordenadas de longitude */
  longitude?: number;

  /** Capacidade de hóspedes */
  capacity?: number;

  /** Número de quartos */
  bedrooms?: number;

  /** Número de banheiros */
  bathrooms?: number;

  /** URL da foto principal */
  photoUrl?: string;

  /** IDs das fechaduras inteligentes associadas */
  lockIds?: string[];

  /** ID do dispositivo Tuya associado */
  tuyaDeviceId?: string;

  /** Data de criação (ISO 8601) */
  createdAt: string;

  /** Data de última atualização (ISO 8601) */
  updatedAt: string;

  /** ID externo (opcional) */
  externalId?: string;

  /** Status ativo/inativo */
  active?: boolean;
}

/**
 * Tipos de erros da API Stays
 */
export type StaysErrorType =
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'TIMEOUT_ERROR'
  | 'NETWORK_ERROR'
  | 'MOCK_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Erro da API Stays
 */
export class StaysError extends Error {
  /** Tipo de erro */
  public readonly type: StaysErrorType;

  /** Status HTTP (se aplicável) */
  public readonly statusCode?: number;

  /** Dados adicionais do erro */
  public readonly details?: Record<string, any>;

  /** Timestamp do erro */
  public readonly timestamp: string;

  /** Identificador de requisição (para debugging) */
  public readonly requestId?: string;

  /**
   * Construtor
   * @param message Mensagem do erro
   * @param type Tipo do erro
   * @param statusCode Status HTTP
   * @param details Dados adicionais
   * @param requestId Identificador da requisição
   */
  constructor(
    message: string,
    type: StaysErrorType = 'UNKNOWN_ERROR',
    statusCode?: number,
    details?: Record<string, any>,
    requestId?: string
  ) {
    super(message);
    this.name = 'StaysError';
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;

    // Manter stack trace correto
    Object.setPrototypeOf(this, StaysError.prototype);
  }

  /**
   * Converter erro para objeto JSON
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }

  /**
   * Converter erro para string
   */
  toString(): string {
    return `${this.name}[${this.type}]: ${this.message}`;
  }

  /**
   * Verificar se é erro de autenticação
   */
  isAuthenticationError(): boolean {
    return this.type === 'AUTHENTICATION_ERROR';
  }

  /**
   * Verificar se é erro de autorização
   */
  isAuthorizationError(): boolean {
    return this.type === 'AUTHORIZATION_ERROR';
  }

  /**
   * Verificar se é erro de validação
   */
  isValidationError(): boolean {
    return this.type === 'VALIDATION_ERROR';
  }

  /**
   * Verificar se é erro de timeout
   */
  isTimeoutError(): boolean {
    return this.type === 'TIMEOUT_ERROR';
  }

  /**
   * Verificar se é erro de rede
   */
  isNetworkError(): boolean {
    return this.type === 'NETWORK_ERROR';
  }

  /**
   * Verificar se é erro de limite de taxa
   */
  isRateLimitError(): boolean {
    return this.type === 'RATE_LIMIT_ERROR';
  }

  /**
   * Verificar se é erro do MOCK
   */
  isMockError(): boolean {
    return this.type === 'MOCK_ERROR';
  }
}

/**
 * Resposta genérica da API Stays
 */
export interface StaysApiResponse<T = any> {
  /** Indica sucesso da operação */
  success: boolean;

  /** Dados retornados (se sucesso) */
  data?: T;

  /** Mensagem de erro (se falha) */
  error?: string;

  /** Tipo de erro (se falha) */
  errorType?: StaysErrorType;

  /** Status HTTP */
  statusCode: number;

  /** Timestamp da resposta */
  timestamp: string;

  /** Identificador de requisição */
  requestId?: string;

  /** Metadados adicionais */
  metadata?: {
    /** Total de items (para paginação) */
    total?: number;

    /** Página atual (para paginação) */
    page?: number;

    /** Items por página (para paginação) */
    pageSize?: number;

    /** Total de páginas (para paginação) */
    totalPages?: number;
  };
}

/**
 * Parâmetros de paginação
 */
export interface PaginationParams {
  /** Número de items por página */
  limit?: number;

  /** Offset para paginação */
  offset?: number;

  /** Campo para ordenação */
  sortBy?: string;

  /** Direção de ordenação (asc/desc) */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Parâmetros de filtro para reservas
 */
export interface ReservationFilterParams extends PaginationParams {
  /** ID da acomodação */
  accommodationId?: string;

  /** Status da reserva */
  status?: ReservationStatus;

  /** Data inicial de check-in */
  checkInDateFrom?: string;

  /** Data final de check-in */
  checkInDateTo?: string;

  /** Buscar atualizações desde timestamp */
  updatedSince?: string;

  /** Nome do hóspede (busca parcial) */
  guestName?: string;
}

/**
 * Parâmetros de filtro para acomodações
 */
export interface AccommodationFilterParams extends PaginationParams {
  /** Buscar por nome */
  name?: string;

  /** Buscar por cidade */
  city?: string;

  /** Filtrar apenas ativas */
  active?: boolean;

  /** Buscar atualizações desde timestamp */
  updatedSince?: string;
}

/**
 * Configuração do cliente Stays
 */
export interface StaysClientConfig {
  /** ID do cliente */
  clientId: string;

  /** Secret do cliente */
  clientSecret: string;

  /** URL base da API */
  baseURL: string;

  /** Timeout em milissegundos */
  timeout?: number;

  /** Número máximo de retries */
  maxRetries?: number;

  /** Ativar modo MOCK */
  enableMock?: boolean;

  /** URL do Redis (para cache) */
  redisUrl?: string;
}

/**
 * Evento de sincronização
 */
export interface SyncEvent {
  /** Tipo de evento */
  type: 'reservation.created' | 'reservation.updated' | 'reservation.cancelled';

  /** Dados da reserva */
  reservation: Reservation;

  /** Timestamp do evento */
  timestamp: string;
}
