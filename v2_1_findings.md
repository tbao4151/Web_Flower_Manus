# CÁ'S HOA V2.1 findings

## Current state
- Production URL: https://cas-hoa.vercel.app/
- Existing Next.js 16 App Router project is a small V2 storefront with one client page at `src/app/page.tsx`.
- Existing backend is `POST /api/orders` using Supabase service-role server-side, but it still requires `customerName` and `customerPhone`, computes shipping as 30,000 VND below 1,000,000 VND, and stores orders through separate inserts.
- Existing migrations: `202608140001_initial_cas_hoa.sql`, `202608140002_seed_cas_hoa.sql`, `202608140003_v2_verified_instagram_catalog.sql`.
- Existing schema has `profiles` with `role` enum and `orders.user_id`, but no complete auth/session route architecture, no guest lookup endpoint, no shop settings table, no admin/staff UI, and no protected Next.js routes.
- Existing source still has Instagram-dependent product copy, buyer name/phone checkout fields, a modal-based product flow, hard-coded contact details, and no real product detail/account routes.
- V2 verified catalog is local TypeScript data with local `/ig-assets/*` paths; production V2 uses those bundled assets.

## V2.1 non-negotiables
- Preserve Next.js + TypeScript + Supabase PostgreSQL/Auth/Storage/RLS + Vercel. Do not reset database or delete orders.
- Customer signup/login uses Vietnamese 10-digit phone + password, no OTP/SMS/email requirement. Normalize phone server-side; minimum password length 8; generic login errors.
- Public signup defaults to customer. Client cannot set role. Staff cannot elevate or manage roles; Admin is required for staff management.
- Server-side route protection for `/tai-khoan/*`, `/staff/*`, `/admin/*`; RLS for own customer data/orders and operational/admin scope.
- Add `/dang-nhap`, `/dang-ky`, `/tai-khoan`, `/tai-khoan/don-hang`, `/tra-cuu-don-hang`, `/staff`, `/staff/don-hang`, `/admin`, `/admin/nhan-vien`, `/admin/cai-dat` and appropriate product/catalog routes without breaking existing storefront.
- Product flow must stay on website: card -> website detail -> cart -> checkout. Instagram only optional social/handoff after order success.
- Checkout removes buyer name/phone. Required recipient name/phone, address, delivery date/time; optional card message/note. Logged-in Customer can use `Tôi là người nhận` to autofill account phone/name. Guest remains able to checkout.
- Shipping must display as `Shop xác nhận sau` unless a real shipping calculation exists; do not assume 0.
- Add secure guest lookup by `order_code + recipient_phone`, generic failure message and rate protection consideration.
- Preserve order snapshots and status history. Add schema via migration only; no destructive rewrite.
- Admin product operations need search/filter/pagination, show/hide/archive/safe delete, featured/type/taxonomy, bulk actions, image upload/preview/delete/reorder/set-cover, and shop settings/announcement control. Staff scope is operational order management only unless policy permits more.
- Preserve 2-column compact mobile product grid, light/dark/system theme, accessible forms/states, and production QA.

## Required delivery
- Run formatter/lint/typecheck/tests/build and production smoke/security checks.
- Commit and push every complete version to `tbao4151/Web_Flower_Manus`; report commit hash and GitHub link in final handoff.

## Supabase Auth documentation check
The current Supabase docs search returned Auth guidance, but the result did not expose a concise phone-password configuration snippet. Implementation should use the supported `supabase.auth.signUp({ phone, password, options })` and `signInWithPassword({ phone, password })` APIs, while the project's phone provider/confirmation settings must be verified in Supabase Dashboard. Do not claim OTP-free signup until the production Auth provider settings are checked.
