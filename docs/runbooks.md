# Runbooks

How to run Bambii in production. Production is the Vercel project `captain` (team `binders1`), served at
https://bambii.ai. Every push to `main` deploys it. Changes to environment variables take effect on the
next deploy, so redeploy after changing one (Vercel → Deployments → ⋯ → Redeploy).

## Checking on production

- **Health:** `curl https://bambii.ai/api/health`. `ok` is false (status 503) when the database or Blob
  doesn't answer. `config: "incomplete"` means a production variable is missing; the alert (and the
  `[alert]` line in the logs) names it.
- **Alerts:** search the Vercel logs for `[alert]`. If `CAPTAIN_ALERT_WEBHOOK_URL` is set, alerts also go
  to that Slack or Discord channel, at most once per 10 minutes per kind per server instance:
  - `server-error` and `request-error`: requests that failed on our side;
  - `model-error`: Anthropic calls that are failing (outage, bad key, spend limit reached);
  - `spend:day:…` and `spend:month:…`: deployment-wide AI spend passed 50%, 80% or 100% of its budget;
  - `config`: production is missing settings.
- **Error references:** users see "Reference: …" on unexpected errors. That's the `x-vercel-id`, and the
  log line starting `[<reference>]` has the error.

## Incidents

1. **Bad deploy:** in Vercel → Deployments, pick the last good production deployment and choose
   "Promote" (or `npx vercel rollback --scope binders1`). Then revert the commit on `main`, because the
   next push deploys again.
2. **Runaway AI spend:** lower the global budgets, e.g. `CAPTAIN_GLOBAL_DAILY_USD=0.01`, and redeploy.
   Model work stops at the next budget check (before each turn and after each model call). Budgets must be
   positive: `0` or a blank value means "use the default". The Anthropic Console's spend limit is the
   backstop.
3. **Abuse from one account:** delete the user in the Clerk dashboard. The `user.deleted` webhook
   removes their data and ends their sessions.
4. **Database or Blob down:** `/api/health` shows which. Check the Turso and Vercel status pages. There's
   nothing to fail over to; the app recovers on its own when the service does (a failed database bootstrap
   is retried on the next request).

## Database schema changes

There's no separate migration step: `migrate()` in `packages/core/src/db.ts` runs when each server
instance first opens the database.

- **New table or index:** add a `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` statement to
  the batch, and the table to `schema.ts`.
- **New column:** add an `ALTER TABLE … ADD COLUMN … NOT NULL DEFAULT …` to the list of later columns
  (a "duplicate column" error there is expected and ignored), and the column to `schema.ts`.
- **Anything else** (renaming, dropping, changing a type): don't do it in `migrate()`. Old and new code
  run side by side during a deploy, so ship it in steps: add the new shape, deploy, backfill, switch the
  code over, deploy, and only then remove the old shape by hand in the Turso shell.

Back up first for anything destructive: Turso keeps point-in-time history, but check the plan's retention.

## Rotating secrets

Set the new value in Vercel's Production environment, redeploy, then revoke the old one.

| Secret | Where to make a new one | What happens to users |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic Console | Nothing. |
| `TURSO_AUTH_TOKEN` | Turso dashboard or `turso db tokens create` | Nothing, if you revoke the old token after the deploy is live. |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → the Blob store | Nothing. |
| `CLERK_SECRET_KEY` | Clerk dashboard → API keys | Nothing. Until `CAPTAIN_SIGNING_SECRET` is set, open app previews break and need a reload. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk dashboard → Webhooks → the endpoint | Nothing. Deletions made in Clerk during the switch are retried by Clerk. |
| `CAPTAIN_SIGNING_SECRET` | `openssl rand -hex 32` | App previews already open in a browser stop loading their files until reloaded. |
| `CRON_SECRET` | `openssl rand -hex 32` | Nothing. |

## Changing a connector's Vercel Connect registration

Connector IDs default to `slack/captain`, `google/captain` and `notion/notion`, and can be overridden with
`CONNECT_SLACK`, `CONNECT_GOOGLE` and `CONNECT_NOTION`.

- **Scopes change** (in `packages/core/src/connectors/index.ts`): update the registration in Vercel
  Connect *first*, then deploy the code. Users connected with the old scopes have to reconnect. Update the
  privacy policy (`apps/web/app/privacy-policy/page.tsx`) and the text in Settings → Connections.
- **New registration ID:** set the `CONNECT_*` variable and redeploy. Tokens belong to the old
  registration, so every user has to connect again.

## Mac app releases

1. Bump `version` in `apps/desktop/package.json`. The updater only installs higher versions.
2. Build, sign and notarize (see "Ship the Mac app" in the README): `npm run desktop:dist`.
3. Upload `release/*.zip`, `release/*.dmg` and `release/latest-mac.yml` to `CAPTAIN_UPDATES_URL`. Upload
   `latest-mac.yml` last: it's what installed apps check, so uploading it is the moment the release goes out.
4. Installed apps check on launch and then periodically, download in the background, and offer a restart.

**Rollback:** the updater never installs a lower version. To roll back, rebuild the last good code under a
*higher* version number and release that. To stop a bad release from spreading before then, put the
previous `latest-mac.yml` back.
