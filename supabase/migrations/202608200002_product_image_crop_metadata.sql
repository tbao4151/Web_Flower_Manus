-- Non-destructive crop/focal metadata for product images.
-- The original file remains untouched in Storage; storefronts use these values
-- only when rendering the fixed 2:3 frame.
alter table public.product_images
  add column if not exists crop_x double precision not null default 0.5,
  add column if not exists crop_y double precision not null default 0.5,
  add column if not exists crop_zoom double precision not null default 1,
  add column if not exists focal_x double precision not null default 0.5,
  add column if not exists focal_y double precision not null default 0.5;

alter table public.product_images
  drop constraint if exists product_images_crop_x_check,
  drop constraint if exists product_images_crop_y_check,
  drop constraint if exists product_images_crop_zoom_check,
  drop constraint if exists product_images_focal_x_check,
  drop constraint if exists product_images_focal_y_check;

alter table public.product_images
  add constraint product_images_crop_x_check check (crop_x >= 0 and crop_x <= 1),
  add constraint product_images_crop_y_check check (crop_y >= 0 and crop_y <= 1),
  add constraint product_images_crop_zoom_check check (crop_zoom >= 1 and crop_zoom <= 3),
  add constraint product_images_focal_x_check check (focal_x >= 0 and focal_x <= 1),
  add constraint product_images_focal_y_check check (focal_y >= 0 and focal_y <= 1);

comment on column public.product_images.crop_x is 'Normalized horizontal crop anchor, preserved with the original Storage asset.';
comment on column public.product_images.crop_y is 'Normalized vertical crop anchor, preserved with the original Storage asset.';
comment on column public.product_images.crop_zoom is 'Display zoom multiplier for the fixed 2:3 storefront frame.';
comment on column public.product_images.focal_x is 'Normalized horizontal focal point for object positioning.';
comment on column public.product_images.focal_y is 'Normalized vertical focal point for object positioning.';

create index if not exists product_images_product_order_idx on public.product_images(product_id, display_order);

notify pgrst, 'reload schema';

-- Rollback is intentionally not included: production data must remain additive and recoverable.

