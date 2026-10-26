# Captain

A Mac app for chatting with bots that work inside your Slack, Gmail and Notion. Bots can also build small apps that are stored and run on your Mac.

```
Captain.app (Electron, apps/desktop) ──loads──▶ Web UI + API (Next.js, apps/web) ──mounts──▶ Bots (eve, agents/*)
   └─ Space: built apps run from disk                         │                                   │
      over captain-app://, with the window.captain bridge     └─ Turso/SQLite · Vercel Blob        └─ Vercel Connect · Vercel Sandbox
```

| Path | What it is |
| --- | --- |
| `agents/captain` | Default bot. Searches the web, works in Slack, Gmail and Notion, and delegates app building to Builder. |
| `agents/builder` | Builds apps in a Vercel Sandbox (`create_app` → code → `package_app`). |
| `agents/app-bot` | The bot for each built app. Reads the app's on-device data and proposes changes to it. |
| `packages/core` | Shared DB schema, auth and connector clients, plus the Slack/Gmail tools, Notion connection and connection instructions that every bot re-exports. Connector tokens are per user, through Vercel Connect. |
| `packages/app-template` | Starter every app is built from, including the `captain` SDK (`src/captain.ts`). Run `npm run sync-template` after editing it. |
| `apps/web` | Threads, sidebar, Space panel, settings, and the runtime APIs that built apps call. |
| `apps/desktop` | Electron shell. Downloads app bundles into `~/Library/Application Support/Captain/apps`, keeps each app's data in SQLite, and enforces per-app connector permissions. |

Each user picks two Claude models in **Settings → Models**: a default model for Captain, app bots and AI calls from apps (Haiku 5.5 unless changed), and an app building model for Builder (Opus 5.5 unless changed). `CAPTAIN_APP_MODEL` forces one model for every app's AI calls.

## How an app gets built
1. In a thread, you ask Builder for something, e.g. "build a task tracker from my Slack messages".
2. Builder looks at real Slack data, then writes a Vite + React app in its sandbox and runs `package_app`, which type-checks and builds it.
3. The new version shows up as a **Launch** card in the thread, and the Space opens. The Mac app downloads the bundle and runs it from disk. Reopening the thread reopens the Space.
4. While it runs, the app can only reach the outside world through `window.captain`:
   - **Local data:** SQLite.
   - **AI:** `/api/runtime/ai`.
   - **Connectors:** `/api/runtime/connectors`, limited to the connectors you approved for that app. Write actions ask you to confirm first.
5. **Ask app** opens the app's own bot. **Edit app** returns to the Builder thread.

## Run locally
Node 24 is pinned in `.node-version` and `.nvmrc` (`nvm use` picks it up). `npm run dev` stops with a message on older Node.

```bash
nvm use
npm install
npm run dev        # web UI + all bots at http://localhost:3000
npm run desktop    # Captain.app pointed at localhost (in another terminal)
```

Without Clerk keys, local dev runs as a single `local-user`, and data goes to `.data/captain.db`.

`vercel env pull` (below) adds Clerk, Turso and Blob keys, which turn on sign-in and point local dev at production data. To keep working as `local-user` with local data, create a gitignored `.env.development.local` that blanks them. `npm run dev` loads it before `.env.local`, so these values win:

```bash
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
BLOB_READ_WRITE_TOKEN=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

### One-time setup (needed for models, connectors and Builder)
1. **Vercel:** run `npm i -g vercel && vercel login && vercel link`, then `vercel env pull .env.local`. This provides the `ANTHROPIC_API_KEY` the bots' models use and the OIDC credentials that Vercel Connect and Vercel Sandbox need. `npm run dev` loads `.env.local` automatically.
2. **Connectors** (from the repo root):
   - `vercel connect create slack --name captain`
   - `vercel connect create https://mcp.notion.com/mcp`
   - Register a Google OAuth client (Gmail scopes) with `vercel connect create`.

   If the generated IDs differ from `slack/captain`, `google/captain` and `notion/notion`, set `CONNECT_SLACK`, `CONNECT_GOOGLE` and `CONNECT_NOTION`.
3. **Production services** (Vercel Marketplace):
   - Turso: `TURSO_DATABASE_URL` (or `DATABASE_URL`), `TURSO_AUTH_TOKEN`
   - Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
   - Vercel Blob: `BLOB_READ_WRITE_TOKEN`
   - Optional: `CAPTAIN_SIGNING_SECRET` signs web-preview URLs for built apps (defaults to `CLERK_SECRET_KEY`).
   - Optional per-user daily limits: `CAPTAIN_DAILY_MESSAGES_LIMIT` (default 200 messages to bots), `CAPTAIN_DAILY_AI_LIMIT` (500 AI calls from apps), `CAPTAIN_DAILY_BUILDS_LIMIT` (20 new apps).

   `vercel env pull` also points local dev at the production Turso database. To keep local data separate, use the `.env.development.local` above.
4. **Deploy:** run `vercel deploy`. `withEve` deploys the web app and every bot as one project.

### Ship the Mac app
Set `captainUrl` in `apps/desktop/package.json` to your deployment URL. Then build:

```bash
export CSC_LINK=… CSC_KEY_PASSWORD=…                         # Developer ID Application certificate
export APPLE_ID=… APPLE_APP_SPECIFIC_PASSWORD=… APPLE_TEAM_ID=…
export CAPTAIN_UPDATES_URL=https://…/desktop                  # where release/*.zip + latest-mac.yml are hosted
npm run desktop:dist                                          # → apps/desktop/release/Captain-<version>-arm64.dmg
```

Gmail's read scopes are *restricted*. A public launch needs Google's OAuth verification and a CASA security assessment, so start that early. Until then, test users work.

## Next milestones
- **Computer bot:** a Vercel Sandbox desktop streamed into the Space (`eve/computer-use`).
- **Google Calendar, Drive, Docs and Sheets bots.**
- **Scheduled bots** (eve schedules), such as a daily digest.
