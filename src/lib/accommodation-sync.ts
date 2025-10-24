import { PrismaClient } from '@prisma/client';

/**
 * AccommodationSyncResult
 *
 * Resultado da sincronização de acomodações
 */
export interface AccommodationSyncResult {
  success: boolean;
  created: number;
  updated: number;
  inactivated: number;
  total: number;
  errors: Array<{
    accommodationId: string;
    error: string;
    action?: 'fetch' | 'create' | 'update' | 'inactivate';
  }>;
  details?: {
    startedAt: string;
    completedAt: string;
    duration: number;
  };
}

/**
 * IStaysClient
 *
 * Interface que define os métodos esperados do cliente Stays
 */
export interface IStaysClient {
  listAccommodations(): Promise<Array<{
    id: string;
    name: string;
  }>>;
}

/**
 * syncAccommodations
 *
 * Sincroniza acomodações da API Stays com o banco de dados local
 *
 * PASSO 1: Busca todas as acomodações da API Stays
 * PASSO 2: Para cada acomodação:
 *   - 2.1: Busca no BD por staysAccommodationId
 *   - 2.2: Se não existe, cria com status=ACTIVE
 *   - 2.3: Se existe e mudou, atualiza
 * PASSO 3: Marca como INACTIVE acomodações removidas da API
 * PASSO 4: Retorna resultado com contadores
 *
 * @param staysClient - Cliente da API Stays
 * @param prisma - Cliente Prisma
 * @param requestId - ID único da requisição (para correlação de logs)
 */
export async function syncAccommodations(
  staysClient: IStaysClient,
  prisma: PrismaClient,
  requestId: string
): Promise<AccommodationSyncResult> {
  const startedAt = new Date();
  const result: AccommodationSyncResult = {
    success: true,
    created: 0,
    updated: 0,
    inactivated: 0,
    total: 0,
    errors: [],
  };

  try {
    // =========================================================================
    // PASSO 1: Fetch all accommodations from Stays API
    // =========================================================================
    logInfo('PASSO 1: Fetching accommodations from Stays API', requestId);

    let staysAccommodations: Array<{ id: string; name: string }> = [];

    try {
      staysAccommodations = await staysClient.listAccommodations();
      logInfo(`Fetched ${staysAccommodations.length} accommodations`, requestId, {
        count: staysAccommodations.length,
      });
    } catch (apiError) {
      const errorMsg =
        apiError instanceof Error ? apiError.message : String(apiError);

      logError('Failed to fetch accommodations from API', requestId, {
        error: errorMsg,
      });

      result.success = false;
      result.errors.push({
        accommodationId: 'API',
        error: errorMsg,
        action: 'fetch',
      });

      return result;
    }

    // =========================================================================
    // PASSO 2: Process each accommodation from API
    // =========================================================================
    logInfo('PASSO 2: Processing accommodations', requestId);

    const staysAccommodationIds = new Set<string>();

    for (const staysAccommodation of staysAccommodations) {
      try {
        const staysId = staysAccommodation.id;
        const name = staysAccommodation.name;

        if (!staysId) {
          logWarn('Skipping accommodation with missing ID', requestId, {
            accommodation: staysAccommodation,
          });

          result.errors.push({
            accommodationId: 'UNKNOWN',
            error: 'Missing accommodation ID from API',
            action: 'fetch',
          });
          continue;
        }

        staysAccommodationIds.add(staysId);

        // =====================================================================
        // PASSO 2.1: Check if exists in DB
        // =====================================================================
        const existingAccommodation =
          await prisma.accommodation.findUnique({
            where: { staysAccommodationId: staysId },
          });

        if (!existingAccommodation) {
          // ===================================================================
          // PASSO 2.2: Create new accommodation
          // ===================================================================
          try {
            const newAccommodation = await prisma.accommodation.create({
              data: {
                staysAccommodationId: staysId,
                name: name || `Accommodation ${staysId}`,
                status: 'ACTIVE',
              },
            });

            result.created++;

            logInfo(
              `Created accommodation: ${newAccommodation.id}`,
              requestId,
              { staysId, name: newAccommodation.name }
            );
          } catch (createError) {
            const errorMsg =
              createError instanceof Error
                ? createError.message
                : String(createError);

            logError(
              `Failed to create accommodation for Stays ID ${staysId}`,
              requestId,
              { error: errorMsg }
            );

            result.errors.push({
              accommodationId: staysId,
              error: errorMsg,
              action: 'create',
            });
          }
        } else {
          // ===================================================================
          // PASSO 2.3: Update if name changed
          // ===================================================================
          const needsUpdate =
            existingAccommodation.name !== name ||
            existingAccommodation.status !== 'ACTIVE';

          if (needsUpdate) {
            try {
              const updatedAccommodation = await prisma.accommodation.update({
                where: { id: existingAccommodation.id },
                data: {
                  name: name || existingAccommodation.name,
                  status: 'ACTIVE',
                },
              });

              result.updated++;

              logInfo(
                `Updated accommodation: ${updatedAccommodation.id}`,
                requestId,
                { staysId, name: updatedAccommodation.name }
              );
            } catch (updateError) {
              const errorMsg =
                updateError instanceof Error
                  ? updateError.message
                  : String(updateError);

              logError(
                `Failed to update accommodation ${existingAccommodation.id}`,
                requestId,
                { error: errorMsg }
              );

              result.errors.push({
                accommodationId: existingAccommodation.id,
                error: errorMsg,
                action: 'update',
              });
            }
          }
        }
      } catch (processingError) {
        const errorMsg =
          processingError instanceof Error
            ? processingError.message
            : String(processingError);

        logError('Error processing accommodation', requestId, {
          error: errorMsg,
        });

        result.errors.push({
          accommodationId: 'UNKNOWN',
          error: errorMsg,
        });
      }
    }

    // =========================================================================
    // PASSO 3: Inactivate accommodations removed from API
    // =========================================================================
    logInfo('PASSO 3: Inactivating removed accommodations', requestId);

    try {
      const accommodationsToInactivate = await prisma.accommodation.findMany({
        where: {
          status: 'ACTIVE',
          staysAccommodationId: {
            notIn: Array.from(staysAccommodationIds),
          },
        },
      });

      for (const accommodation of accommodationsToInactivate) {
        try {
          await prisma.accommodation.update({
            where: { id: accommodation.id },
            data: {
              status: 'INACTIVE',
            },
          });

          result.inactivated++;

          logInfo(
            `Inactivated accommodation: ${accommodation.id}`,
            requestId,
            { staysId: accommodation.staysAccommodationId }
          );
        } catch (inactivateError) {
          const errorMsg =
            inactivateError instanceof Error
              ? inactivateError.message
              : String(inactivateError);

          logError(
            `Failed to inactivate accommodation ${accommodation.id}`,
            requestId,
            { error: errorMsg }
          );

          result.errors.push({
            accommodationId: accommodation.staysAccommodationId,
            error: errorMsg,
            action: 'inactivate',
          });
        }
      }
    } catch (batchError) {
      const errorMsg =
        batchError instanceof Error ? batchError.message : String(batchError);

      logError('Failed to inactivate removed accommodations', requestId, {
        error: errorMsg,
      });

      result.errors.push({
        accommodationId: 'BATCH_INACTIVATE',
        error: errorMsg,
        action: 'inactivate',
      });
    }

    // =========================================================================
    // PASSO 4: Calculate totals and complete
    // =========================================================================
    result.total = result.created + result.updated + result.inactivated;
    result.success = result.errors.length === 0;

    const completedAt = new Date();
    const duration = completedAt.getTime() - startedAt.getTime();

    result.details = {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      duration,
    };

    logInfo('PASSO 4: Sync completed successfully', requestId, {
      created: result.created,
      updated: result.updated,
      inactivated: result.inactivated,
      total: result.total,
      errors: result.errors.length,
      duration,
    });

    return result;
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);

    logError('Unexpected error during sync', requestId, {
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
    });

    result.success = false;
    result.errors.push({
      accommodationId: 'SYSTEM',
      error: errorMsg,
    });

    return result;
  }
}

/**
 * Logging utilities with requestId and structured format
 */

function logInfo(
  message: string,
  requestId: string,
  details?: Record<string, any>
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      requestId,
      message,
      component: 'accommodation-sync',
      ...(details && { details }),
    })
  );
}

function logWarn(
  message: string,
  requestId: string,
  details?: Record<string, any>
): void {
  console.warn(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'warn',
      requestId,
      message,
      component: 'accommodation-sync',
      ...(details && { details }),
    })
  );
}

function logError(
  message: string,
  requestId: string,
  details?: Record<string, any>
): void {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      requestId,
      message,
      component: 'accommodation-sync',
      ...(details && { details }),
    })
  );
}
