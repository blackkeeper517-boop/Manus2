# Deploy NIGHTOPS on Vercel

## Token source verification

The live `page_tokens_vault` table currently has seven configured pages and a token in the `access_token` column for each page. The server now queries exactly:

```text
page_tokens_vault?select=page_id,page_name,access_token&page_id=eq.<PAGE_ID>&limit=1
```

The lookup sends `SUPABASE_SERVICE_ROLE_KEY` in server-side `apikey` and `Authorization` headers. The browser never receives the token. `META_PAGES_JSON` and the single-page environment variables are only fallbacks when Supabase is unavailable or the page row has no token.

## Important Vercel limitation

The current project starts a long-running Express server from `server/_core/index.ts`. It is ready for the existing managed server, but it is **not a direct Vercel deployment entrypoint** yet. Vercel needs a serverless function entry under `api/` (and the Express app must be exported instead of calling `listen`). Do not upload the current `dist/index.js` and expect Vercel to run it as-is.

## Recommended deployment path

1. Push the project to a private Git repository.
2. Import the repository into Vercel.
3. Add the server-only Environment Variables in the Vercel project settings:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
META_APP_SECRET
META_WEBHOOK_VERIFY_TOKEN
```

Do not prefix these with `VITE_`. Never add `SUPABASE_SERVICE_ROLE_KEY` to client variables.

4. Keep the public client variables only if the app uses them; audit the built browser bundle to ensure no service-role key appears.
5. Before switching Meta webhooks, deploy a Vercel-compatible API adapter for `/api/trpc` and `/api/meta/webhook`. The current Express `listen()` entry is for a persistent Node server, not a Vercel Function.
6. Point the Meta webhook callback to the deployed `/api/meta/webhook` URL only after the GET verification and signed POST test pass.
7. Test a harmless read first, then test one page-token lookup by page ID. Do not test sending until the webhook/API route and Meta app permissions are confirmed.

## Safer interim option

Keep the current managed deployment for the Express server and use Vercel only for the static client after a split. This avoids breaking tRPC, OAuth, uploads, webhook ingestion, and the server-side token lookup while the adapter is being implemented.
