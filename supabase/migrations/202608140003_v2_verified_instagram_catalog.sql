-- CÁ'S HOA V2 verified catalog.
-- This migration never deletes products, orders, users, or order snapshots.
-- Existing V1 seed products are hidden so historical order references remain intact.

update public.products
set status = 'hidden', updated_at = now()
where source_reference = 'seed:cas-hoa-v1'
  and status <> 'archived';

insert into public.products (id, sku, slug, name, product_type, price_vnd, sale_price_vnd, description, composition, featured, status, source_caption, source_reference)
values
  ('20000000-0000-4000-8000-000000000001', 'IG-LAM-TINH-400', 'lam-tinh', 'Lam tinh', 'bouquet', 400000, null, '', null, true, 'published', 'Lam tinh\n400🐡', 'https://www.instagram.com/p/DbqTJdTFGng/'),
  ('20000000-0000-4000-8000-000000000002', 'IG-GARDEN-380', 'garden', 'Garden', 'bouquet', 380000, null, 'Màu hoa ly có thể đậm, nhạt khác nhau tuỳ đợt hoa.', null, true, 'published', 'Garden 🧚🏻‍♀️\n380🐡\nMàu hoa ly có thể đậm, nhạt khác nhau tuỳ đợt hoa', 'https://www.instagram.com/p/Dbc8oEKFCO4/'),
  ('20000000-0000-4000-8000-000000000003', 'IG-HOA-LY-350', 'hoa-ly', 'Hoa ly', 'bouquet', 350000, null, 'Màu hoa ly có thể đậm, nhạt khác nhau tuỳ đợt hoa.', null, true, 'published', 'Hoa ly 🩷🎀🦩🩰\n350🐡\nMàu hoa ly có thể đậm, nhạt khác nhau tuỳ đợt hoa', 'https://www.instagram.com/p/Dbc8XX0lAL4/'),
  ('20000000-0000-4000-8000-000000000004', 'IG-LY-XANH-370', 'ly-xanh', 'Ly xanh', 'bouquet', 370000, null, 'Bó sẽ có 3–5 bông ly phụ thuộc kích thước hoa.', null, true, 'published', '🩵🦋🐬🐳🫐\nBó sẽ có 3-5 bông ly phụ thuộc kích thước hoa\n370🐡', 'https://www.instagram.com/p/Dbc8GJXFHc0/'),
  ('20000000-0000-4000-8000-000000000005', 'IG-LILY-310', 'lily', 'Lily', 'bouquet', 310000, null, '', null, false, 'published', 'Lily 🦋🐬🫐🧵🩵\n310🐡', 'https://www.instagram.com/p/DbSElLSAcaH/'),
  ('20000000-0000-4000-8000-000000000006', 'IG-MOT-BO-HOA-390', 'mot-bo-hoa-mot-lan-duoc-nho-den', 'Một bó hoa, một lần được nhớ đến', 'bouquet', 390000, null, '', null, false, 'published', 'Một bó hoa, một lần được nhớ đến♥️🌹🍷🍒\n390🐡', 'https://www.instagram.com/p/DbKpmHKgcHb/'),
  ('20000000-0000-4000-8000-000000000007', 'IG-CAM-TU-CAU-450', 'cam-tu-cau', 'Cẩm tú cầu', 'bouquet', 450000, null, '', null, false, 'published', 'Cẩm tú cầu 💚\n450🐡', 'https://www.instagram.com/p/DbKovTNgadK/'),
  ('20000000-0000-4000-8000-000000000008', 'IG-PHI-YEN-370', 'phi-yen', 'Phi yến', 'bouquet', 370000, null, '', null, false, 'published', 'Phi yến 💜\n370🐡', 'https://www.instagram.com/p/DbFXU4-AZDP/'),
  ('20000000-0000-4000-8000-000000000009', 'IG-SON-SAC-290', 'son-sac-thuy-chung', 'Son sắc thuỷ chung', 'bouquet', 290000, null, '', null, false, 'published', '💜Son sắc thuỷ chung💜\n290🐡', 'https://www.instagram.com/p/DbFXEtMgXYe/')
on conflict (id) do update set
  sku = excluded.sku,
  slug = excluded.slug,
  name = excluded.name,
  product_type = excluded.product_type,
  price_vnd = excluded.price_vnd,
  sale_price_vnd = excluded.sale_price_vnd,
  description = excluded.description,
  composition = excluded.composition,
  featured = excluded.featured,
  status = excluded.status,
  source_caption = excluded.source_caption,
  source_reference = excluded.source_reference,
  updated_at = now();

delete from public.product_images
where product_id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000006',
  '20000000-0000-4000-8000-000000000007',
  '20000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000009'
);

insert into public.product_images (product_id, storage_path, alt_text, display_order, mime_type)
values
  ('20000000-0000-4000-8000-000000000001', 'v2/instagram/lam-tinh.jpg', 'Bó hoa Lam tinh từ CÁ''S HOA', 0, 'image/jpeg'),
  ('20000000-0000-4000-8000-000000000002', 'v2/instagram/garden.jpg', 'Bó hoa Garden từ CÁ''S HOA', 0, 'image/jpeg'),
  ('20000000-0000-4000-8000-000000000003', 'v2/instagram/hoa-ly.jpg', 'Bó hoa ly từ CÁ''S HOA', 0, 'image/jpeg'),
  ('20000000-0000-4000-8000-000000000004', 'v2/instagram/ly-xanh.jpg', 'Bó ly xanh từ CÁ''S HOA', 0, 'image/jpeg'),
  ('20000000-0000-4000-8000-000000000005', 'v2/instagram/lily.jpg', 'Bó Lily từ CÁ''S HOA', 0, 'image/jpeg'),
  ('20000000-0000-4000-8000-000000000006', 'v2/instagram/mot-bo-hoa.jpg', 'Bó hoa Một bó hoa, một lần được nhớ đến từ CÁ''S HOA', 0, 'image/jpeg'),
  ('20000000-0000-4000-8000-000000000007', 'v2/instagram/cam-tu-cau.jpg', 'Bó cẩm tú cầu từ CÁ''S HOA', 0, 'image/jpeg'),
  ('20000000-0000-4000-8000-000000000008', 'v2/instagram/phi-yen.jpg', 'Bó phi yến từ CÁ''S HOA', 0, 'image/jpeg'),
  ('20000000-0000-4000-8000-000000000009', 'v2/instagram/son-sac-thuy-chung.jpg', 'Bó Son sắc thuỷ chung từ CÁ''S HOA', 0, 'image/jpeg');
