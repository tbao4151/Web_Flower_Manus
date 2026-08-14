# CÁ'S HOA — Version 2

CÁ'S HOA is a production-oriented flower-shop storefront for **bó hoa** and **giỏ hoa**. Version 2 is a commerce-first, mobile-first storefront grounded in verified Instagram source posts, with a searchable catalog, quick-add shopping, guest checkout, authoritative server pricing, Supabase order persistence and explicit Instagram/Zalo handoff after an order is created.

## Run locally

Use Node.js 20+ and pnpm. Install dependencies, copy `.env.example` to `.env.local`, then start the development server:

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The public storefront can render catalog and cart interactions without Supabase configuration. The order endpoint intentionally refuses to create an order when server-side Supabase variables are missing, so a local preview cannot be mistaken for a production checkout.

## Supabase setup

Apply the migrations in order through the Supabase migration pipeline:

1. `supabase/migrations/202608140001_initial_cas_hoa.sql`
2. `supabase/migrations/202608140002_seed_cas_hoa.sql`
3. `supabase/migrations/202608140003_v2_verified_instagram_catalog.sql`

Set the following environment variables in `.env.local` and Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
NEXT_PUBLIC_INSTAGRAM_URL=https://www.instagram.com/your-shop
NEXT_PUBLIC_ZALO_URL=https://zalo.me/your-shop
```

The service-role key is used only in the server route and must never be exposed in client code, public variables, logs or source control. The V2 storefront ships its reviewed product images as versioned files under `public/ig-assets`, which makes the deployment self-contained and avoids a manual Storage upload requirement. The Supabase schema still retains Storage paths and metadata for the future Admin media workflow.

## V2 feature status

| Area | V2 status | Notes |
| --- | --- | --- |
| Commerce-first homepage | Ready | Product discovery is the primary homepage task; editorial story sections were removed from the first viewport. |
| Navigation and search | Ready | Compact brand header, catalog jump, always-available search trigger and direct product discovery. |
| Product discovery | Ready | Verified Instagram-backed catalog with type, tone, price and sorting controls. |
| Quick shopping | Ready | Product cards support direct add-to-cart; detail modal remains available for deeper review. |
| Mobile product grid | Ready | Two-column product-first grid with compact cards, dense spacing and mobile-friendly controls. |
| Cart | Ready in browser session | Quantity changes, removal, subtotal, shipping and total presentation with local guest-cart persistence. |
| Guest checkout | Server endpoint ready after Supabase setup | Validates input, reloads authoritative product prices, recalculates totals and saves order/items. |
| Duplicate prevention | Ready in endpoint contract | Uses a client idempotency key and database uniqueness constraints. |
| Instagram/Zalo handoff | Ready after order success | Copies the human-readable order summary and opens configured shop destinations; never claims that a message was sent. |
| Supabase schema/RLS | Migration applied | Includes profiles, roles, catalog relations, order snapshots, status history and Storage policies. |
| Verified V2 catalog | Migration applied | Old seed products are hidden safely; the reviewed catalog is upserted without deleting order history. |
| Admin dashboard | Not in V2 storefront surface | Role and RLS foundations are present; CRUD screens remain a subsequent operations release. |
| Online payment | Intentionally excluded | No fake payment gateway or completed-payment state is present. |

## V2 asset and data policy

The catalog copy and prices in V2 are derived from the connected CÁ'S HOA Instagram posts reviewed during implementation. Where source data did not provide enough information, the storefront avoids inventing composition, occasion or service claims. The local `scripts/` directory contains the reproducible import and contact-sheet utilities used for review; the review-only contact sheet is not shipped in the production asset folder.

## Important launch checks

Before accepting a larger volume of real orders, configure the shop's final Instagram/Zalo destinations, create the first Admin account through a controlled server-side process, verify RLS policies, add an independent PostgreSQL backup and test checkout at mobile and desktop widths. The next recommended product release is an Admin Dashboard for product/media/order operations and a controlled Supabase Storage media workflow.

## Verification

```bash
pnpm lint
pnpm build
```

The V2 implementation builds successfully. Lint reports only the existing `no-img-element` optimization warnings from the compact storefront card markup; there are no lint errors or TypeScript/build failures.
