-- CÁ'S HOA business taxonomy terminology.
-- The technical table names remain stable for backward compatibility and data safety.
-- public.product_types is presented as “Dạng sản phẩm” (currently Bó hoa / Giỏ hoa).
-- public.categories and public.product_categories are presented as “Loại hoa”
-- and remain a many-to-many relationship so a product can contain multiple flower types.
comment on table public.product_types is 'CÁ''S HOA business label: Dạng sản phẩm. Current supported values: Bó hoa and Giỏ hoa.';
comment on table public.categories is 'CÁ''S HOA business label: Loại hoa. Technical table name retained for compatibility.';
comment on table public.product_categories is 'CÁ''S HOA business relationship: products to multiple Loại hoa values.';
comment on column public.products.product_type is 'CÁ''S HOA business label: Dạng sản phẩm.';

-- No rows are renamed, deleted, or rewritten by this migration.

