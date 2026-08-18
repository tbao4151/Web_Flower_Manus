-- Add an explicit export transaction type for manual warehouse issues.
-- Existing transaction values remain unchanged.
ALTER TYPE public.inventory_transaction_type ADD VALUE IF NOT EXISTS 'export';
