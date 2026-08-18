# Production baseline audit

Date: 2026-08-18

## Homepage

- URL: https://cas-hoa.vercel.app/
- Title: CÁ'S HOA — Hoa cho những điều khó nói
- Homepage loads successfully.
- Current visible navigation includes Trang chủ, Bó hoa, Giỏ hoa, search, Đăng nhập, Đăng ký, Tra cứu đơn, and Cart.
- Current homepage product cards visibly include quick-add buttons and product imagery.
- Announcement bar is visible above the main navigation.
- Production screenshot showed the hero region still loading/blank at capture time while lower CTA content was visible; this is a baseline observation, not yet a confirmed defect.

## Customer account

- Direct navigation to /tai-khoan redirects to /dang-nhap?next=%2Ftai-khoan when unauthenticated.
- Login page loads successfully and provides a guest-shopping link.
- Authenticated account-page UX could not be inspected without a customer session.

## Route/source synchronization

- The connected desktop folder E:\web_hoa was empty and was not a Git checkout.
- The selected GitHub repository was cloned into /home/ubuntu/Web_Flower_Manus for the audit.
- Repository branch: main.
- Git HEAD at clone: c42fdb0f6892f8d6feb3ccd3adde2a6615e5c7e2.
- HEAD matched origin/main at clone time.
- Recent commit: fix: secure management sessions and add manual orders.
- Working tree was clean at clone time.

## Known next audit items

- Determine production deployment commit SHA and compare with Git HEAD.
- Inspect package/build/lint/typecheck configuration and source routes/components.
- Inspect Supabase migrations/schema/RLS without modifying the database.
- Baseline lint, typecheck, tests if present, and production build.
