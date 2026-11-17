# We Cooked

Our household recipe book and meal plan. Self-hosted, one Docker container.

- **Recipes**: name plus optional second name (e.g. Chinese), photo, ingredients in sections that scale with servings, steps split into Preparation and Cooking with timers, source links.
- **Pill filters** by group (Protein, Meal, Cuisine…; editable): any pill within a group, all groups together (Beef or Chicken, and Dinner). Search across names and ingredients.
- **Collections**: themed sets such as "Weeknight" or "CNY".
- **Notes from the kitchen** on every recipe (brands that worked, tweaks), with an optional 1–5 heart rating. A recipe’s score counts each member’s latest rating once; sort by **Highest rated**.
- **Meal plan**: week grid with your own rows, text or linked recipes, add to several days at once, repeat, drag to move (Alt-drag to copy), copy last week, "away" events, red weekends and public holidays, cooking-history dots on each recipe.
- **Everyone in the household is equal.** People are managed on `/admin` with one shared password.
- **Guests** (anyone with the link) can read recipes, collections and notes. Only members can change anything or see the meal plan.
- **AI agents** (Claude Code, Codex CLI, Gemini CLI) can read and add recipes through MCP with a personal API key. What they add is marked for review.
- Each device signs in once and stays signed in. Installable to the phone home screen. Light, Dark or Auto colour mode, chosen per device.

## Running it on a server

You need Docker with Compose. The app listens on port 8000 inside the container; the compose file publishes it on host port 80.

```bash
mkdir -p ~/wecooked && cd ~/wecooked
curl -fsSLO https://raw.githubusercontent.com/Issac4/we-cooked/main/deploy/docker-compose.yml
cat > .env <<EOF
ADMIN_PASSWORD=$(openssl rand -base64 24)
PUBLIC_URL=https://wecooked.issacbeth.com
EOF
chmod 600 .env
docker compose pull && docker compose up -d
```

Then open `https://<your site>/admin`, unlock it with the `ADMIN_PASSWORD` from `.env`, create an invite link and open it yourself to make the first account. Invite the rest of the household the same way. Share the admin password with the people who should be able to invite others or make password reset links.

| Setting | What it is |
|---|---|
| `ADMIN_PASSWORD` | Required, at least 16 characters. Unlocks `/admin`. |
| `PUBLIC_URL` | The address people use. Goes into invite links, share previews and the MCP setup shown to members. |

### Updating from v1 (FastAPI + Postgres)

v1 data is not carried over. On the server, in the folder with the old `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.prod.yml down -v   # stops v1 and deletes its database and photos
```

Then follow "Running it on a server" above. v2 also uses host port 80, so a Cloudflare Tunnel pointing at `http://localhost:80` keeps working. If the tunnel pointed at the old container name (`recipe_frontend`), point it at `localhost:80` instead.

If the image is private on GitHub Container Registry, either make the `we-cooked` package public (GitHub → Packages → we-cooked → Package settings) or run `docker login ghcr.io` on the server with a token that can read packages.

### Later updates

```bash
cd ~/wecooked
docker compose exec app node dist/cli.js backup   # optional safety copy
docker compose pull && docker compose up -d       # database changes are applied on start
```

### Backups

All data lives in the `wecooked-data` volume: `wecooked.db` (SQLite) and `uploads/` (photos).

```bash
docker compose exec app node dist/cli.js backup          # writes /data/backups/wecooked-<date>.db, safe while running
docker run --rm -v wecooked_wecooked-data:/data -v "$PWD":/out alpine tar czf /out/wecooked-backup.tgz -C /data .
```

To restore, stop the app, put `wecooked.db` and `uploads/` back into the volume, and start it again.

### Recipes deleted by mistake

Deleted recipes stay in **Trash** (sidebar, bottom) for 30 days. Anyone in the household can restore them.

## Connecting an AI agent

Each member creates their own key on the **Me** page (read-only, or read and add). The page shows the exact setup for Claude Code, Codex CLI and Gemini CLI with the key filled in. For Claude Code it is:

```bash
claude mcp add --transport http wecooked https://wecooked.issacbeth.com/mcp --header "Authorization: Bearer wc_…"
```

Then ask, for example: *"Add this recipe to We Cooked: https://…"*. The server keeps agents to the household format:

- Steps must be marked `preparation` or `cooking`. Quantities are numbers.
- Only existing tag ids are accepted (an unknown id is refused with the list of valid tags). New tags and recipes that look like existing ones are refused unless the agent explicitly confirms they are different.
- The household's own rules (**Household settings → Rules for AI agents**) are sent to the agent when it connects.
- Agents can never delete anything or touch accounts, keys, `/admin` or settings.
- What an agent adds or edits shows **Added by AI · needs review** until someone clicks **Looks good**.
- Photos: an agent can set a recipe's cover from a public web link (e.g. a YouTube thumbnail), or upload a file from your computer through a one-time link (works once, expires in 10 minutes). Links to private or local addresses are refused.

## Developing

Requires Node 24.

```bash
npm install
npm run dev          # web on http://localhost:5180, API on :8787, both reload on save
```

`npm run dev` reads `.env` in the repository root if present. Without `ADMIN_PASSWORD` the dev admin password is `dev-admin-password`.

| Command | |
|---|---|
| `npm run check` | Typecheck, unit/API tests, production build, end-to-end tests |
| `npm test` | API and MCP tests (Vitest, in-memory database) |
| `npm run test:e2e` | Playwright against the real build on a throwaway database (`npm run build` first) |
| `npm run db:generate -w server` | Create a migration after changing `server/src/db/schema.ts` |
| `docker compose up --build` | Production-like run of this checkout on http://localhost:8000 (needs `.env`) |

### Layout

```
shared/   zod schemas and helpers used by the server, the web app and the MCP tools
server/   Hono API, SQLite via Drizzle (migrations in server/drizzle), MCP server, auth
web/      React + Vite + Tailwind single-page app
e2e/      Playwright end-to-end tests
deploy/   docker-compose.yml for the server
```

### Releasing

CI runs on every push and pull request. Pushing a SemVer tag (e.g. `v2.0.0`) also builds and publishes `ghcr.io/issac4/we-cooked:<tag>` and `:latest`.

```bash
git tag v2.0.0 && git push origin v2.0.0
```
