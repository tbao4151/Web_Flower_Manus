# CÁ'S HOA V2 working notes

## Sources
- V2 storefront brief: /home/ubuntu/upload/pasted_content_2.txt
- Mobile product grid brief: /home/ubuntu/upload/pasted_content_3.txt
- Current production URL: https://cas-hoa.vercel.app/

## Current production findings
The deployed V1 homepage is editorial-first. It renders an announcement bar, a large hero, a long story section, then only three featured products. It includes unverified factual/operational content: “Miễn phí giao hàng nội thành cho đơn từ 1.000.000đ”, “06+ năm làm hoa”, “4.9/5 khách hàng yêu thích”, “Giao hoa nội thành nhanh chóng”, “Instagram: @cas.hoa”, “Zalo: 09xx xxx xxx”, “TP. Hồ Chí Minh”, and “08:00 — 20:00”. The hero image and product images are Unsplash URLs, not Supabase/Instagram-owned production assets.

## V2 target hierarchy
Optional announcement only from real shop settings; compact commerce header; short hero with real flower photography and CTAs “Xem bó hoa” and “Xem giỏ hoa”; quick shopping; featured products near the top; product type/price; real occasions and tones; new products based on real data; small Instagram section only if backed by real assets; short brand story near the end; factual footer fields only when populated.

## Hard requirements
- Keep Supabase/PostgreSQL/Auth/RLS/Storage/order API and authoritative server pricing intact.
- Do not delete/reset products, orders, or users.
- Only sell bouquets and baskets; do not introduce boxes, vases, wedding, or gift sets.
- Remove invented statistics, placeholder contacts, unverified delivery/opening-hours claims, and wrong Instagram handles.
- Mobile product listing must be 2 columns at widths 320–430px, with near-square image-first cards, compact name/price/description, 8–12px gaps, and roughly 6 products visible in the first catalog area at 390x844.
- Desktop can use 4–6 columns depending on width; keep density high without making cards hard to use.
- Search must be easy to access, with clear/no-results states. Mobile filters should use Sheet/Drawer/Bottom Sheet.
- Product detail must preserve gallery, name, price, type, metadata, description if real, quantity, and add-to-cart.
- Preserve dark/light/system theme, warm-white/sage/pastel pink botanical palette, accessible controls, visible focus, touch targets, no horizontal overflow.
- QA actual deployment at 320/360/375/390/430/768/1024/1280/1440 widths, lint, typecheck, build, deploy and visually inspect.

## Current source observations
- Main storefront is in src/app/page.tsx and is a single client component.
- Product seed is in src/lib/products.ts with 8 published products, local UUIDs, invented descriptions/compositions/categories/tones/occasions, and Unsplash image URLs.
- Existing API route is src/app/api/orders/route.ts; do not weaken it.
- Existing migrations are under supabase/migrations/.

## Implementation direction
Refactor storefront behavior and content hierarchy, not backend architecture. Use existing product data as the source for currently available filters, but do not render unsupported factual claims. Replace the long story/metrics-first homepage with a compact product-first flow and update product card CSS/classes for dense 2-column mobile grid. If no verified shop_settings or owned imagery is available, omit those fields or use the existing product data only where the brief allows; do not invent replacements.

## Verified Instagram data
The connected Instagram Business account is `@nfishtt_flower`, display name `Cá's hoa`, bio `Tiệm hoa tươi online`, address `126/13 đường số 17 Linh Xuân, Thủ Đức, HCM`, service note `Luôn kèm sẵn thiệp và túi`, and Zalo phone `0356.925.367`. The account reports 201 posts and its public website field is a TikTok URL. This is the verified account identity; the current V1 footer values `@cas.hoa`, `09xx xxx xxx`, and generic address/hours are incorrect or unverified and must be removed/replaced.

The Instagram connector returned current post media and captions from the verified account. Clear priced examples include: `Lam tinh` 400 (post https://www.instagram.com/p/DbqTJdTFGng/); `Garden` 380 with caption that lily color can vary by flower batch (https://www.instagram.com/p/Dbc8oEKFCO4/); `Hoa ly` 350 with the same seasonal-color note (https://www.instagram.com/p/Dbc8XX0lAL4/); a blue-lily bouquet with 3–5 lily stems depending on flower size at 370 (https://www.instagram.com/p/Dbc8GJXFHc0/); `Cúp hoa tươi` 370–400 (https://www.instagram.com/p/Dbc7ig5FPxI/); `Lily` 310 (https://www.instagram.com/p/DbSElLSAcaH/); `Một bó hoa, một lần được nhớ đến` 390 (https://www.instagram.com/p/DbKpmHKgcHb/); `Cẩm tú cầu` 450 (https://www.instagram.com/p/DbKovTNgadK/); `Phi yến` 370 (https://www.instagram.com/p/DbFXU4-AZDP/); `Son sắc thuỷ chung` 290 (https://www.instagram.com/p/DbFXEtMgXYe/); and `Cẩm tú cầu quế` with Size M 230, Size L 350, optional graduation/rabbit add-on +30 (https://www.instagram.com/p/Da-sRBdlCyd/). Posts also include products outside the current project scope such as box flowers; those must not be added because CÁ'S HOA currently sells only bouquets and baskets.

The post result includes media URLs and thumbnails from Instagram. These URLs are source references only and should not be used as the long-term production asset source. The Supabase production project has a public `product-images` Storage bucket, but the current product rows still point at seed `unsplash-*` paths and the local storefront uses Unsplash URLs. V2 should either migrate selected verified Instagram thumbnails into Supabase Storage or clearly keep the seed catalog separate from verified product content rather than implying unsupported provenance.
