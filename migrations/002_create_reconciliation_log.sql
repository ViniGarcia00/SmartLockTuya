-- Create ReconciliationLog table for tracking reconciliation executions
CREATE TABLE reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Execution metadata
  "lastRunAt" TIMESTAMP WITH TIME ZONE,
  "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- milliseconds
  
  -- Statistics
  fetched INTEGER DEFAULT 0,
  created INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  orphaned INTEGER DEFAULT 0,
  deleted INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, success, failed
  message TEXT,
  
  -- Timestamps
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  CONSTRAINT valid_status CHECK (status IN ('pending', 'success', 'failed'))
);

-- Create indexes
CREATE INDEX idx_reconciliation_logs_started_at ON reconciliation_logs("startedAt" DESC);
CREATE INDEX idx_reconciliation_logs_status ON reconciliation_logs(status);
CREATE INDEX idx_reconciliation_logs_created_at ON reconciliation_logs("createdAt" DESC);

-- Add unique constraint to prevent concurrent runs
CREATE UNIQUE INDEX idx_reconciliation_logs_pending 
  ON reconciliation_logs(status) 
  WHERE status = 'pending';

-- Add comments
COMMENT ON TABLE reconciliation_logs IS 'Audit trail for periodic Stays API reconciliation jobs';
COMMENT ON COLUMN reconciliation_logs.status IS 'Job status: pending (running), success (completed), failed (error)';
COMMENT ON COLUMN reconciliation_logs.fetched IS 'Count of reservations fetched from Stays API';
COMMENT ON COLUMN reconciliation_logs.created IS 'Count of new reservations created';
COMMENT ON COLUMN reconciliation_logs.updated IS 'Count of existing reservations updated';
COMMENT ON COLUMN reconciliation_logs.orphaned IS 'Count of orphaned PIN jobs cleaned up';
