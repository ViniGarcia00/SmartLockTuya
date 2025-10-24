/**
 * Admin Endpoint: Revoke PIN Manually
 *
 * POST /api/admin/reservations/[id]/revoke-pin
 *
 * Trigger manual revocation of temporary PIN for a specific reservation
 *
 * Headers:
 * - Authorization: Bearer <admin-token> (required)
 * - Content-Type: application/json
 *
 * Parameters:
 * - id: Reservation ID (path parameter)
 *
 * Response (Success):
 * {
 *   "success": true,
 *   "jobId": "job-uuid",
 *   "message": "PIN revocation job enqueued"
 * }
 *
 * Response (Error):
 * {
 *   "success": false,
 *   "error": "error message",
 *   "code": "ERROR_CODE"
 * }
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

// Import job queue
let revokePinQueue: any = null;
try {
  const { getRevokePinQueue } = require('../../../../../../jobs/queues');
  revokePinQueue = getRevokePinQueue();
} catch (error) {
  console.warn(
    '[Admin API] ⚠️ Aviso: Fila de revogação de PIN não disponível'
  );
}

// Initialize Prisma
const prisma = new PrismaClient();

// Create router
const router = express.Router();

/**
 * Validate admin authentication
 *
 * In production, this should verify JWT token with admin role
 * For now, we check for a specific authorization header
 */
function validateAdminAuth(req: any): { isValid: boolean; error?: string } {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return {
      isValid: false,
      error: 'Missing authorization header',
    };
  }

  // Check for Bearer token
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return {
      isValid: false,
      error: 'Invalid authorization scheme (use Bearer)',
    };
  }

  // In production, verify JWT token and check admin role
  // For now, we accept any Bearer token
  // TODO: Implement proper JWT validation with admin role check
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_TOKEN) {
    console.warn(
      '[Admin API] ⚠️ ADMIN_TOKEN not configured in production'
    );
  }

  // Optional: Validate against specific token if configured
  if (process.env.ADMIN_TOKEN && token !== process.env.ADMIN_TOKEN) {
    return {
      isValid: false,
      error: 'Invalid admin token',
    };
  }

  return { isValid: true };
}

/**
 * POST /api/admin/reservations/:id/revoke-pin
 *
 * Manually trigger PIN revocation for a reservation
 */
router.post('/:id/revoke-pin', async (req: any, res: any) => {
  const reservationId = req.params.id;
  const requestId = uuidv4();

  try {
    console.log(
      `\n[Admin API] [${requestId}] POST /api/admin/reservations/${reservationId}/revoke-pin`
    );

    // =====================================================================
    // PASSO 1: Validate admin authentication
    // =====================================================================
    const authValidation = validateAdminAuth(req);

    if (!authValidation.isValid) {
      console.error(
        `[Admin API] [${requestId}] 🔐 Authentication failed: ${authValidation.error}`
      );

      return res.status(401).json({
        success: false,
        error: authValidation.error,
        code: 'UNAUTHORIZED',
      });
    }

    console.log(`[Admin API] [${requestId}] ✅ Authentication validated`);

    // =====================================================================
    // PASSO 2: Validate reservation ID format
    // =====================================================================
    if (
      !reservationId ||
      typeof reservationId !== 'string' ||
      !reservationId.trim()
    ) {
      console.error(
        `[Admin API] [${requestId}] ❌ Invalid reservation ID: ${reservationId}`
      );

      return res.status(400).json({
        success: false,
        error: 'Invalid reservation ID',
        code: 'INVALID_ID',
      });
    }

    // =====================================================================
    // PASSO 3: Check if reservation exists
    // =====================================================================
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        staysReservationId: true,
        status: true,
        checkOutAt: true,
        accommodationId: true,
      },
    });

    if (!reservation) {
      console.error(
        `[Admin API] [${requestId}] ❌ Reservation not found: ${reservationId}`
      );

      return res.status(404).json({
        success: false,
        error: 'Reservation not found',
        code: 'NOT_FOUND',
      });
    }

    console.log(`[Admin API] [${requestId}] ✅ Reservation found:`);
    console.log(`  - Status: ${reservation.status}`);
    console.log(`  - CheckOut: ${reservation.checkOutAt?.toISOString()}`);

    // =====================================================================
    // PASSO 4: Check if reservation has active credentials to revoke
    // =====================================================================
    const activeCredentials = await prisma.credential.count({
      where: {
        reservationId: reservationId,
        status: 'ACTIVE',
      },
    });

    console.log(
      `[Admin API] [${requestId}] ℹ️ Active credentials: ${activeCredentials}`
    );

    if (activeCredentials === 0) {
      console.warn(
        `[Admin API] [${requestId}] ⚠️ No active credentials to revoke`
      );

      return res.status(200).json({
        success: true,
        message: 'No active credentials to revoke',
        code: 'NO_CREDENTIALS',
      });
    }

    // =====================================================================
    // PASSO 5: Enqueue revocation job
    // =====================================================================
    if (!revokePinQueue) {
      console.error(
        `[Admin API] [${requestId}] ❌ Revoke PIN queue not available`
      );

      return res.status(503).json({
        success: false,
        error: 'Revoke PIN queue not available',
        code: 'QUEUE_UNAVAILABLE',
      });
    }

    try {
      const job = await revokePinQueue.add(
        {
          reservationId: reservationId,
        },
        {
          jobId: `admin-revoke-${reservationId}-${requestId}`,
          priority: 20, // Very high priority for manual admin actions
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false, // Keep failed jobs for debugging
        }
      );

      console.log(`[Admin API] [${requestId}] ✅ Job enqueued successfully:`);
      console.log(`  - Job ID: ${job.id}`);
      console.log(`  - Reservation ID: ${reservationId}`);

      // =====================================================================
      // PASSO 6: Audit log
      // =====================================================================
      try {
        await prisma.auditLog.create({
          data: {
            action: 'ADMIN_REVOKE_PIN_TRIGGERED',
            entity: 'Credential',
            entityId: reservationId,
            userId: 'admin-manual-trigger',
            details: {
              reservationId: reservationId,
              jobId: job.id,
              requestId: requestId,
              activeCredentialsCount: activeCredentials,
              triggeredAt: new Date().toISOString(),
            },
          },
        });

        console.log(
          `[Admin API] [${requestId}] ✅ Audit log created`
        );
      } catch (auditError) {
        console.warn(
          `[Admin API] [${requestId}] ⚠️ Failed to create audit log:`,
          auditError
        );
        // Continue anyway, don't fail the request
      }

      // =====================================================================
      // PASSO 7: Return success response
      // =====================================================================
      return res.status(202).json({
        success: true,
        jobId: job.id,
        reservationId: reservationId,
        activeCredentialsCount: activeCredentials,
        message: `PIN revocation job enqueued for ${activeCredentials} credential(s)`,
      });

    } catch (queueError) {
      console.error(
        `[Admin API] [${requestId}] ❌ Error enqueuing job:`,
        queueError
      );

      return res.status(500).json({
        success: false,
        error: 'Failed to enqueue revocation job',
        code: 'QUEUE_ERROR',
        details:
          process.env.NODE_ENV === 'development'
            ? queueError instanceof Error
              ? queueError.message
              : 'Unknown error'
            : undefined,
      });
    }

  } catch (error) {
    console.error(`[Admin API] [${requestId}] ❌ Unexpected error:`, error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : undefined,
    });

  } finally {
    await prisma.$disconnect();
  }
});

module.exports = router;
