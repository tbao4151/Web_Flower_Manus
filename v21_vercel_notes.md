# V2.1 Vercel notes

Source: https://vercel.com/tbao4151s-projects (accessed 2026-08-14)

The authenticated Vercel Hobby team is `tbao4151s-projects` with team ID `team_RClTjDoKRzSfUnFHrFpRrSmD`. The existing production project is `cas-hoa`, deployed at https://cas-hoa.vercel.app and linked to https://github.com/tbao4151/Web_Flower_Manus. The dashboard exposes an Environment Variables page at https://vercel.com/tbao4151s-projects/~/settings/environment-variables; project-specific settings are available at https://vercel.com/tbao4151s-projects/cas-hoa.

The Vercel MCP project listing returned no projects for this team, so dashboard/browser access is the available path for adding `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

The team Environment Variables page loaded successfully. Existing project `cas-hoa` variables are `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, both currently marked for Production and Preview. The project link is `/tbao4151s-projects/cas-hoa/settings/environment-variables`; the team page itself is filtered to Projects and shows the `cas-hoa` row.

The project-level Vercel settings page is available at https://vercel.com/tbao4151s-projects/cas-hoa/settings/environment-variables. It shows `Add Environment Variable` and confirms only `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are currently configured for Production and Preview. A transient browser action failure occurred once; reopening the page restored the controls.

The Vercel add-variable form accepted key `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the active Supabase publishable key. The form defaults to the `Production and Preview` environment scope; this is appropriate because the existing Supabase URL and service-role variables use the same scope. The value is masked in the UI and ready to save.

Vercel successfully added `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `cas-hoa` for Production and Preview. Vercel displayed: “A new deployment is needed for changes to take effect.” The upcoming V2.1 GitHub push will trigger that deployment, so the old deployment should not be manually redeployed.
