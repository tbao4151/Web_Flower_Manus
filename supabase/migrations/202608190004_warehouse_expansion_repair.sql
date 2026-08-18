-- Repair migration: the first warehouse migration was recorded but the schema objects were absent.
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS inventory_type text NOT NULL DEFAULT 'flower';
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_inventory_type_check;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_inventory_type_check CHECK (inventory_type IN ('flower', 'accessory'));

CREATE TABLE IF NOT EXISTS public.inventory_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 30),
  inventory_type text NOT NULL CHECK (inventory_type IN ('flower', 'accessory')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, inventory_type)
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_units_type_name_key ON public.inventory_units (inventory_type, lower(trim(name)));

INSERT INTO public.inventory_units (name, inventory_type) VALUES
  ('cành', 'flower'), ('bông', 'flower'), ('lá', 'flower'), ('nhánh', 'flower'), ('bó', 'flower'),
  ('cuộn', 'accessory'), ('tờ', 'accessory'), ('cái', 'accessory'), ('chiếc', 'accessory'), ('bộ', 'accessory'), ('gói', 'accessory'), ('hộp', 'accessory'), ('mét', 'accessory')
ON CONFLICT DO NOTHING;
INSERT INTO public.inventory_units (name, inventory_type)
SELECT DISTINCT trim(ii.unit), 'flower' FROM public.inventory_items ii
WHERE char_length(trim(ii.unit)) BETWEEN 1 AND 30 ON CONFLICT DO NOTHING;

ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS inventory_unit_id uuid;
UPDATE public.inventory_items ii SET inventory_unit_id = iu.id FROM public.inventory_units iu
WHERE ii.inventory_type = iu.inventory_type AND lower(trim(ii.unit)) = lower(trim(iu.name));
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.inventory_items WHERE inventory_unit_id IS NULL) THEN RAISE EXCEPTION 'inventory_unit_backfill_incomplete'; END IF;
END $$;
ALTER TABLE public.inventory_items ALTER COLUMN inventory_unit_id SET NOT NULL;
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_inventory_unit_id_fkey;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_inventory_unit_id_fkey FOREIGN KEY (inventory_unit_id, inventory_type) REFERENCES public.inventory_units (id, inventory_type) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_type_name_key ON public.inventory_items (inventory_type, lower(trim(name)));
CREATE INDEX IF NOT EXISTS inventory_items_type_active_name_idx ON public.inventory_items (inventory_type, is_active, name);

ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage inventory units" ON public.inventory_units;
CREATE POLICY "admins manage inventory units" ON public.inventory_units FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "staff view inventory units" ON public.inventory_units;
CREATE POLICY "staff view inventory units" ON public.inventory_units FOR SELECT USING (public.is_staff_or_admin());
