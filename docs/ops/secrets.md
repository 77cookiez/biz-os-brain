# Secrets & Environment Variables Reference

> Single source of truth for all secrets used by AI Business OS.

## Required Secrets

| Secret | Where Used | Description |
|--------|-----------|-------------|
| `SUPABASE_URL` | Edge Functions (auto), Vercel | Supabase project URL. Auto-set in Edge Functions. Set in Vercel as `SUPABASE_URL`. |
| `SUPABASE_ANON_KEY` | Edge Functions (auto), Frontend | Publishable anon key. Safe for client-side. Auto-set in Edge Functions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions (auto) | **Server-only.** Full database access. Never expose client-side. Auto-set in Edge Functions. |
| `DRAFT_CONFIRMATION_HMAC_KEY` | Edge Functions | HMAC signing key for draft confirmations. If not set, falls back to `SUPABASE_SERVICE_ROLE_KEY`. |
| `MAINTENANCE_KEY` | Edge Functions, Vercel, GitHub Actions | Authenticates `maintenance-cleanup` edge function. Must match `x-maintenance-key` header. |
| `CRON_SECRET` | Vercel | Protects the `/api/maintenance/cleanup` Vercel serverless route from unauthorized callers. |

## Where to Configure

### Lovable Cloud (Edge Functions)

Secrets are managed via Lovable Cloud. The following are auto-provisioned:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`  
- `SUPABASE_SERVICE_ROLE_KEY`

Must be manually added:
- `MAINTENANCE_KEY`
- `DRAFT_CONFIRMATION_HMAC_KEY` (optional, recommended)

### Vercel (if deploying there)

Set in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `MAINTENANCE_KEY` | Same value as in Edge Functions |
| `CRON_SECRET` | A random secret (e.g., `openssl rand -hex 32`) |

### GitHub Actions

Set in **Repository → Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|--------|---------|
| `VITE_SUPABASE_URL` | Supabase URL for tests |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key for tests |
| `SUPABASE_SERVICE_ROLE_KEY` | For gated behavioral tests |
| `MAINTENANCE_KEY` | For cleanup cron workflow |
| `MAINTENANCE_CLEANUP_URL` | Full Edge Function URL: `https://<project>.supabase.co/functions/v1/maintenance-cleanup` |

## Rotation Procedures

### Rotating MAINTENANCE_KEY

1. Generate a new key: `openssl rand -hex 32`
2. Update in Lovable Cloud secrets
3. Wait for edge function redeployment (~30 seconds)
4. Update in Vercel env vars (if used)
5. Update in GitHub Actions secrets
6. Verify: `curl -X POST <edge-function-url> -H "x-maintenance-key: <new-key>"`

**Zero-downtime note:** The edge function reads `MAINTENANCE_KEY` on each request, so updating the secret takes effect immediately after deployment. Update all callers within a few minutes to avoid rejected requests.

### Rotating CRON_SECRET

1. Generate a new key: `openssl rand -hex 32`
2. Update in Vercel env vars
3. No other systems use this key

### Rotating DRAFT_CONFIRMATION_HMAC_KEY

1. Generate a new key: `openssl rand -hex 64`
2. Update in Lovable Cloud secrets
3. **Impact:** Any pending (unexecuted) draft confirmations signed with the old key will fail verification. Users will need to re-confirm those drafts.

## Security Rules

- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code, logs, or responses
- **Never** log secret values — log only key names and masked references
- `maintenance-cleanup` authenticates via `x-maintenance-key` header only — it does NOT use JWT
- The Vercel cron route (`/api/maintenance/cleanup`) is protected by `CRON_SECRET`
- All edge functions with `verify_jwt = false` implement their own auth checks in code
