# CÁ'S HOA — Upgrade audit notes

Nguồn yêu cầu: `/home/ubuntu/upload/Pasted_content_01.txt`.

## Current production evidence

- Production URL: https://cas-hoa.vercel.app/
- Git repo: https://github.com/tbao4151/Web_Flower_Manus
- Current HEAD before this upgrade: `f7fa8b4998d9bb07c10be59d92555174b2f3f821`.
- Existing public tables: categories, color_tones, inventory_items, inventory_transactions, occasions, order_items, order_lookup_audit, order_status_history, orders, product_categories, product_images, product_ingredients, product_occasions, product_tones, products, profiles, shop_settings.
- Existing enums: app_role(customer/staff/admin); order_status(pending_confirmation/confirmed/preparing/delivering/completed/cancelled); inventory_transaction_type(import/order/damaged/adjustment/reserve/release); product_status(draft/published/hidden/archived); product_type(bouquet/basket); sale_mode_type(ready_stock/preorder).
- Existing RLS includes protected orders/order_items/profiles, staff/admin operational access, admin-only product ingredients, inventory tables and shop settings.

## Requirements to implement

1. Admin dashboard `/admin`: admin-only server route and API protection, cards for new/pending/deposit/preparing/today delivery/today total/revenue/low-stock/next 24h.
2. Admin navigation: Tổng quan, Đơn hàng, Sản phẩm, Kho hoa, Khách hàng, Giao hàng, Lịch sử kho, Cài đặt.
3. Preserve existing product CRUD, Storage image workflow, database-backed storefront, BOM and preorder. No rewrite/no destructive data changes.
4. Inventory transaction audit must support quantity_before, quantity_after, reason, note, order_id, created_by, created_at. Transaction types required: IMPORT, ORDER_RESERVE, ORDER_RELEASE, ORDER_CONSUME, DAMAGED, ADJUSTMENT. Existing enum uses lowercase reserve/release; migration 016 adds `consume` and migration 017 rewrites RPCs with audit fields. Existing old rows may have null audit before/after.
5. Product availability remains computed from BOM: MIN(floor((on_hand - reserved)/required)); public API never exposes BOM, inventory or exact counts.
6. Product sale mode: ready_stock/preorder; preorder lead time validated at checkout server-side and client-side; cart MAX preorder hours with product name in message.
7. Order workflow should preserve existing statuses and add `ready`: pending_confirmation -> confirmed -> preparing -> ready -> delivering -> completed; cancellation only from valid pre-consumption states; status history required.
8. Reserve on confirmation; release on cancellation before consume; consume exactly once when order reaches ready/delivering/completed; PostgreSQL row locks/RPC prevent oversell and double operations.
9. Manual payment: add payment_status unpaid/partially_paid/paid, deposit_required_vnd, deposit_paid_vnd, remaining_amount_vnd generated, order_payments history with amount, method, paid_at, note, created_by. No gateway.
10. Delivery: delivery_method delivery/pickup; pickup shipping=0; delivery shipping remains “shop confirms” until admin input; admin can update shipping, carrier, shipper, estimated delivery, delivery_status; total recomputes as subtotal+shipping; payment status/remaining recalculates.
11. Admin orders: search code/name/phone, date/status/today filters, details, status updates, payment deposit entry, shipping entry.
12. Admin customers: aggregate guest + account customers by normalized phone, order count, lifetime order value, latest order, search name/phone/email; no unsafe guest/account auto-merge.
13. Customer tracking: lookup order code + recipient phone only; expose safe fields: items, total, deposit, remaining, order status, receive datetime, delivery status. Never recipe/internal notes/inventory.
14. Customer account orders/profile must stay owner-scoped; guest checkout remains.
15. UI: preserve storefront, add badges/CTA only; mobile responsive; no raw alert; loading/error/success/confirmation for dangerous actions.
16. Contact links: Instagram DM first `https://ig.me/m/nfishtt_flower`, Zalo second `https://zalo.me/0356925367`; use shop_settings and apply preorder, consult and handoff CTAs.
17. Security: service role server only; Zod input validation; no trust client prices/totals/stock/payment/role; RLS and server auth; test IDOR.

## Additive migrations already applied during this upgrade

- `202608140015_order_payments_delivery_audit.sql`: payment enums, delivery enums, order payment/delivery columns, order_payments table/RLS, payment/shipping RPCs, inventory audit columns.
- `202608140016_inventory_consume_workflow.sql`: commits `ready` order status and `consume` inventory enum value.
- `202608140017_inventory_consume_functions.sql`: consume index and atomic adjust/reserve/release/consume RPCs.

## Mandatory tests from specification

1 admin access; 2 customer denied; 3 guest denied; 4 create product storefront; 5 price update; 6 image upload; 7 hide product; 8 recipe admin-only; 9 public API no recipe; 10 enough stock; 11 1-2 stock low; 12 zero ingredient out; 13 import updates all products; 14 preorder 24h + 30h accepted; 15 preorder 24h + 20h rejected; 16 Instagram/Zalo shown; 17 cart max 24/48 => 48; 18 direct API preorder rejection; 19 cart no reserve; 20 confirmation reserve; 21 cancellation release; 22 concurrent reserve only one; 23 no double reserve; 24 no double consume; 25 payment remaining; 26 delivery shipping unknown not zero; 27 shipping update total; 28 pickup zero shipping; 29 valid lookup; 30 IDOR denied; 31 customer phone search; 32 guest checkout; 33 lint; 34 build; 35 mobile layout.
