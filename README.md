# Destroyed by Moths FanFest

A fan-engagement site for the band Destroyed by Moths: fans sign in with an emailed code, earn XP for quests (visits, quizzes, polls, uploads, social proof, email signup, invites), climb weekly, monthly and lifetime leaderboards, and claim rewards. The band runs everything from `/destroyedbymoths/admin`.

It is built to host more than one band: each band is a row in `channels`, served at `/<slug>`.

## Stack

- Next.js 16 (App Router, TypeScript, Server Actions), Tailwind 4, pnpm
- Supabase: Postgres, Auth (email OTP), Storage. All XP writes go through Postgres functions in `supabase/migrations/0002_functions.sql`; row-level security is on everywhere.
- Vercel for hosting (Pro plan for a merch-promoting site).
- Tests: Vitest (unit) and Playwright (end-to-end, phone viewport).

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in the Supabase values from Project Settings -> API Keys
pnpm dev                     # http://localhost:3000 -> /destroyedbymoths
```

Database: apply `supabase/migrations/*.sql` in order to a fresh project (Supabase SQL editor, the MCP, or `supabase db push` after `supabase link`). `0004_seed_dbm.sql` seeds the channel, quests, news and rewards with placeholder copy; edit them in the admin area.

Auth email: `supabase/config.toml` holds the auth settings and `supabase/templates/*.html` the email with the 6-digit code. Push them with `supabase config push`. Before launch, set `site_url` to the production domain and configure custom SMTP (for example Resend with a verified band domain); Supabase's built-in email service is rate-limited and for development only.

## Admin

Admin rights live in `channel_admins`. After someone signs in once:

```bash
node --env-file=.env.local scripts/set-admin.mts amanda@example.com destroyedbymoths
node --env-file=.env.local scripts/set-admin.mts someone@example.com destroyedbymoths --remove
```

The script refuses to remove the last admin.

## How XP works

- `xp_ledger` is append-only. Every award is one row with a `period_key`; a unique index on `(fan_id, quest_id, period_key)` makes double pay impossible. Totals and boards are sums.
- Week and day boundaries use the channel's `timezone` (default `America/Los_Angeles`). Weeks start Monday.
- Daily visit, link visits, polls, quizzes, email signup, fan art and merch-in-the-wild pay instantly. Playlist screenshots, receipts and social links wait in `/admin/review` and pay on Approve.
- Fan art and merch-in-the-wild appear under `/admin/uploads`: Feature and Hide keep the XP, Remove reverses it with a negative row.
- Invites convert when the invited fan earns their first XP other than Daily Visit; the inviter is paid in the same transaction, up to the cap in the invite quest's config (`{"cap": 10}`).

## Tests

```bash
pnpm exec vitest run                                   # unit
node --env-file=.env.local scripts/seed-test-users.mts  # once: admin@test.dbm, fan1..3@test.dbm
pnpm exec playwright test                              # end to end against pnpm dev
```

The end-to-end suite signs test accounts in with generated magic-link tokens, so it needs `SUPABASE_SECRET_KEY` in `.env.local`. It wipes the test fans' XP first and, when it finishes, hides the test fans from the public boards and reopens the draws it closed. Point `E2E_BASE_URL` at a deployment to test it live (`E2E_BASE_URL=https://dbm-fanfest.vercel.app pnpm exec playwright test`).

## Deploy

```bash
vercel login
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_SECRET_KEY production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel --prod
```

Then add the production URL to `additional_redirect_urls` and `site_url` in `supabase/config.toml` and push the config again.

## Matching the Figma

The design is the Figma Sites file "DBM" (figma.com/site/GYEU1tG1pavHWKE9tjZ3PC). Figma's file and node endpoints refuse Sites files, so the tooling works from an SVG export of the page plus the image-fills endpoint.

```bash
# token: Figma -> Settings -> Security -> personal access token (file content read-only)
mkdir -p ~/.config/figma && printf '%s' 'figd_...' > ~/.config/figma/token && chmod 600 ~/.config/figma/token

node scripts/figma-pull.mts          # tries the REST file API (works for Design files)
node scripts/figma-rasterize.mts     # renders figma/frames/*.svg in Chromium at 2x -> figma/renders
E2E_BASE_URL=http://localhost:3000 node scripts/figma-compare.mts   # side-by-side + diff -> figma/compare/index.html
```

For this Sites file the page SVG was fetched with `GET /v1/images/:key?ids=0:1&format=svg&svg_include_id=true&svg_include_node_id=true&svg_outline_text=false`, image fills with `GET /v1/files/:key/images`, and per-frame inventories (every text layer with font, size, weight, colour and position) were written to `figma/inventory-*.md`. Frame node ids: /dbm Desktop 64:5258, Tablet 64:5634, Mobile 64:6010; landing 30:7058 and 80:7113; Join or Sign In modal 66:7033. The exact image assets are in `public/dbm`. Design tokens live at the top of `app/globals.css`; change the Figma first, then the tokens.

## Handoff checklist

- [ ] GitHub: Transfer Ownership of this repository.
- [ ] Vercel: transfer the project, or recreate it from the repo and set the four env vars.
- [ ] Supabase: transfer the project; rotate the secret key after the transfer.
- [ ] Email: verify the band's sending domain and set SMTP in `supabase/config.toml`.
- [ ] Domain: point it at Vercel; update `site_url` and `NEXT_PUBLIC_SITE_URL`.
- [ ] Admins: run `scripts/set-admin.mts` for the band's accounts, then remove the builder's.
- [ ] Content: replace placeholder quest copy, XP values, links (`/admin/settings`) and rewards.

## Layout

```
app/[channel]/            channel home, sign-in, account, privacy, leaderboard
app/[channel]/q/[quest]/  quest detail: quiz and poll forms, uploads, links, email list, invites
app/[channel]/admin/      review queue, uploads, quests, news, rewards, fans, email list, settings
app/go/[channel]/[quest]/ visit-link quests: log the click, award, redirect
app/auth/confirm/         magic-link landing
lib/                      Supabase clients, data loaders, quest state, link rules, period keys
supabase/migrations/      schema, RLS, functions, storage, seed
scripts/                  test users, admin grants
tests/                    unit (vitest) and e2e (playwright)
```
