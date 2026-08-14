# CÁ'S HOA — Version 1

CÁ'S HOA is a production-oriented flower-shop storefront for **bó hoa** and **giỏ hoa**. Version 1 includes a responsive public storefront, catalog search/filter/sort, product detail, client cart, guest checkout UI, server-side order validation, Supabase migration foundations, and explicit Instagram/Zalo handoff after an order is persisted.

## Run locally

Use Node.js 20+ and pnpm. Install dependencies, copy `.env.example` to `.env.local`, then start the development server:

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The public storefront works without Supabase configuration for browsing and cart review. **The order endpoint intentionally refuses to create an order when Supabase server variables are missing**, so a local preview cannot be mistaken for a production checkout.

## Supabase setup

Create a Supabase project and apply `supabase/migrations/202608140001_initial_cas_hoa.sql` through the Supabase SQL editor or your migration pipeline. Then set the following environment variables in `.env.local` and Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
NEXT_PUBLIC_INSTAGRAM_URL=https://www.instagram.com/your-shop
NEXT_PUBLIC_ZALO_URL=https://zalo.me/your-shop
```

The service-role key is used only in the server route and must never be exposed in client code, public variables, logs, or source control. Product images belong in the `product-images` Storage bucket; PostgreSQL stores paths and metadata rather than binary image data.

## V1 feature status

| Area | V1 status | Notes |
| --- | --- | --- |
| Public storefront | Ready | Branded homepage, story, services and CTA sections. |
| Product discovery | Ready with seed catalog | Search by name/SKU/category, type/tone/occasion/price filters, and sort options. |
| Product detail | Ready | Accessible modal with composition, price and add-to-cart action. |
| Cart | Ready in browser session | Quantity changes, removal, subtotal, shipping and total presentation. |
| Guest checkout | Server endpoint ready after Supabase setup | Validates input, reloads authoritative product prices, recalculates totals and saves order/items. |
| Duplicate prevention | Ready in endpoint contract | Requires a client idempotency key and unique database constraint. |
| Instagram/Zalo handoff | Ready after order success | Copies the human-readable order summary and opens configured shop destinations; never claims that a message was sent. |
| Supabase schema/RLS | Migration ready | Includes profiles, roles, catalog relations, order snapshots, status history and Storage policies. |
| Admin dashboard | Not in V1 storefront surface | The migration supports admin/staff authorization; CRUD screens should be added after the shop's real Instagram seed and operator accounts are confirmed. |
| Instagram seed import | Pending source confirmation | The current catalog is UI seed data. Replace it with approved source posts and upload retained media to Storage before launch. |
| Online payment | Intentionally excluded | No fake payment gateway or completed-payment state is present. |

## Important launch checks

Before accepting real orders, import approved product records into Supabase, upload retained media into Storage, configure Instagram/Zalo destinations, create the first Admin account through a controlled server-side process, verify RLS policies, add an independent PostgreSQL backup, and test checkout at mobile and desktop widths. The current public page uses remote Unsplash images as temporary visual seed assets; they should be replaced by shop-owned Storage assets for production.

## Verification

```bash
pnpm lint
pnpm build
```

The current implementation builds successfully. The lint step may report image optimization warnings because the V1 visual seed uses remote editorial images; replacing those images with Supabase Storage URLs and `next/image` is part of the production media pass.
