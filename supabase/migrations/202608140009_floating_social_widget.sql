-- Floating Social Contact Widget settings for the public storefront.
-- The admin settings API validates and normalizes values before writing updates.

insert into public.shop_settings (key, value_json, is_public)
values (
  'social_widget',
  '{"enabled": true, "instagram_url": "https://www.instagram.com/nfishtt_flower/", "zalo_url": "https://zalo.me/0356925367"}'::jsonb,
  true
)
on conflict (key) do nothing;
