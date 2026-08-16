-- CÁ'S HOA additive enum values for the extended order and inventory workflow.
-- Kept separate because PostgreSQL requires a newly added enum value to commit
-- before it can be referenced by indexes, constraints, or functions.

DO $$
BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready' AFTER 'preparing';
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TYPE public.inventory_transaction_type ADD VALUE IF NOT EXISTS 'consume';
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;
