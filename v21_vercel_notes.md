# V2.1 Vercel notes

Source: https://vercel.com/tbao4151s-projects (accessed 2026-08-14)

The authenticated Vercel Hobby team is `tbao4151s-projects` with team ID `team_RClTjDoKRzSfUnFHrFpRrSmD`. The existing production project is `cas-hoa`, deployed at https://cas-hoa.vercel.app and linked to https://github.com/tbao4151/Web_Flower_Manus. The dashboard exposes an Environment Variables page at https://vercel.com/tbao4151s-projects/~/settings/environment-variables; project-specific settings are available at https://vercel.com/tbao4151s-projects/cas-hoa.

The Vercel MCP project listing returned no projects for this team, so dashboard/browser access is the available path for adding `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

The team Environment Variables page loaded successfully. Existing project `cas-hoa` variables are `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, both currently marked for Production and Preview. The project link is `/tbao4151s-projects/cas-hoa/settings/environment-variables`; the team page itself is filtered to Projects and shows the `cas-hoa` row.

The project-level Vercel settings page is available at https://vercel.com/tbao4151s-projects/cas-hoa/settings/environment-variables. It shows `Add Environment Variable` and confirms only `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are currently configured for Production and Preview. A transient browser action failure occurred once; reopening the page restored the controls.

The Vercel add-variable form accepted key `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the active Supabase publishable key. The form defaults to the `Production and Preview` environment scope; this is appropriate because the existing Supabase URL and service-role variables use the same scope. The value is masked in the UI and ready to save.

Vercel successfully added `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `cas-hoa` for Production and Preview. Vercel displayed: “A new deployment is needed for changes to take effect.” The upcoming V2.1 GitHub push will trigger that deployment, so the old deployment should not be manually redeployed.

Vercel’s Deployments page lists a new Production deployment with commit `c038ba4` and message `feat: deliver CAS HOA storefront v2.1 auth and operations`, created about one minute after the push. The displayed deployment URL `cas-fwsi5589-tbao4151s-projects.vercel.app` returned `404 DEPLOYMENT_NOT_FOUND` when opened directly, so deployment readiness needs confirmation from the Vercel dashboard/build details rather than that generated URL.

The Vercel dashboard definitively shows the V2.1 deployment as `Ready`, `Production`, created about two minutes ago, with dashboard deployment ID `EPPTwRWduDU8fTGFhpU3aSk1rT4D` and GitHub commit `c038ba450f31972f1c9e0c5485d1db58327364ba`. The generated deployment URL itself returned `DEPLOYMENT_NOT_FOUND` in the sandbox browser, but the dashboard status is Ready and the production deployment is associated with the new commit.

Production smoke tests passed for `https://cas-hoa.vercel.app/`: the homepage rendered with the botanical storefront, Vietnamese navigation, `Tài khoản`, `Tra cứu đơn`, product cards, and the 9 Instagram assets. `https://cas-hoa.vercel.app/dang-nhap` also rendered the expected Vietnamese phone/password login form with signup and guest-shopping links.

Production guest lookup smoke tests passed: `/tra-cuu-don-hang` rendered the Vietnamese order-code and recipient-phone form, and a nonexistent lookup request returned the controlled JSON error `{"error":"Không tìm thấy đơn hàng phù hợp."}` without exposing data or producing a server error.
