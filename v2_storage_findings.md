# V2 Storage findings

The production Supabase project `kbfcxsbibrtafkokhfev` has a public `product-images` bucket. The V2 image folder structure was created through the authenticated dashboard as `v2/instagram/`, matching the `product_images.storage_path` values in the V2 migration. Direct REST upload with the sandbox publishable key was rejected by Storage RLS, so the authenticated dashboard upload flow is being used instead. The V2 source image files are in `public/ig-assets/`; the review-only contact sheet is not part of the production asset set.
