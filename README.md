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

## Chat

The Figma chat pill opens a fan chat panel. Everyone can read it; fans sign in to post (the join modal opens for visitors). Messages go through `post_chat_message`, which trims the text to 500 characters, refuses hidden and banned fans, and limits a fan to 3 posts per 10 seconds and 40 per 10 minutes, with a repeat of the same line inside a minute refused. A fan can delete their own message and a channel admin can delete any (logged in `admin_actions`); deleted rows stay in the table with `deleted_at` set. The panel updates through Supabase Realtime on `chat_messages` plus a 20 s poll while open. Signed-in fans ping `touch_presence` every 4 minutes, and `fans_online` counts fans seen in the last 10 minutes. Recent Activity on the channel page scrolls on its own and refreshes every 30 s.

## Listening quest

"Stream Destroyed by Moths" pays XP for actual plays. It is live. Three ways to link, in the order the quest page offers them, all in the shape of the EJAE site's Spotify card:

- **Spotify** (one tap, the EJAE flow): "Connect Spotify" sends the fan to `/api/spotify/connect`, which bounces through Spotify's approval page and back to `/api/spotify/callback`. The callback swaps the code for tokens (`listen_accounts.access_token`, `refresh_token`, `token_expires_at`, server-only columns; `username` is the Spotify user id and `display_name` what the fan sees) and returns to the quest page with `?spotify=connected`. Reads use `/me/player/recently-played`, which keeps a fan's last 50 plays only. The scope is `user-read-recently-played` and nothing else.
- **Last.fm** (one click): same shape through `/api/lastfm/connect` and `/callback`; the session key is stored. Last.fm records plays from Tidal, Deezer, YouTube and most desktop players once the fan links their player under Last.fm → Settings → Applications. Its API terms allow non-commercial use only; Amanda accepted that on Oct 28, 2026.
- **ListenBrainz** (paste a token): the last fallback, behind "Use ListenBrainz instead"; the token is checked with ListenBrainz and discarded.
- **Checking plays**: the quest page checks on load and once a minute while open ("Check my plays" forces one, at most once a minute), and a daily Vercel Cron job (`/api/cron/listens`, `vercel.json`) checks every connected fan. Reads start from the moment the fan connected. A paid Vercel plan allows an hourly cron, which suits Spotify's 50-play window better.
- **XP** through `award_listens`: a play of the band's songs pays the quest's XP once per song per local day, up to `daily_cap` songs a day; any other play pays `any_play_xp` once per play (the timestamp is the dedupe key), up to `any_play_cap` a day. Placeholders: 25 XP a song, 4 songs a day; 5 XP a play, 10 plays a day. Activity shows `Streamed "Song"` and `Streamed music`.
- Quest config (Admin → Quests): `artist` (defaults to the channel name), `artist_mbid` once the band is in MusicBrainz, `daily_cap`, `any_play_xp`, `any_play_cap`, and `services` (ListenBrainz only, an allowlist such as `["spotify.com"]`).
- Apple Music and Amazon Music plays cannot reach any of the three. Plays are self-reported by the fan's apps, so they can be faked; the caps bound that.

Spotify setup (the band owns this, like the Last.fm key): at https://developer.spotify.com/dashboard create an app (Web API), redirect URIs `https://dbm-fanfest.vercel.app/api/spotify/callback` and `http://127.0.0.1:3000/api/spotify/callback`, then set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in Vercel (Production) and `.env.local`. A new app starts in **development mode**: only up to 25 Spotify accounts added under the app's User Management can connect, and anyone else sees "Spotify has not approved this site for your account yet". Request **extended quota mode** from the app's settings to open it to every fan; Spotify asks for a verified business account. Without the Spotify keys the page offers Last.fm first.

## Filler data

Until real fans arrive, the live site is filled with seeded activity so it looks busy: 60 fake fans (`first.l<n>@seed.dbm`, `fans.is_seed = true`) with 75 days of XP history, extra XP rows for the builder's own account so it sits near the top of the boards, and about 150 chat lines (`chat_messages.is_seed = true`) over the last 10 days. Every seeded ledger row carries `ref_type = 'seed'`. The plan is deterministic (`scripts/filler-plan.mts`, seeded from each fan's email), so a refresh produces the same people with history shifted to today.

```bash
node --env-file=.env.local scripts/seed-filler.mts             # add; refuses to run while seeded fans exist
node --env-file=.env.local scripts/seed-filler.mts --refresh   # remove, then add again from today
node --env-file=.env.local scripts/seed-filler.mts --remove    # remove only
```

`--remove` deletes the seeded auth users (their fans, ledger and chat rows cascade), every `chat_messages` row with `is_seed` and every `xp_ledger` row with `ref_type = 'seed'`, and nothing else. Run it before the handoff to Adam: the filler must not ship to the band. `--slug` picks the channel and `--me` the owner account that gets the extra rows (default `perice09@gmail.com`). The script ends by printing the owner's weekly, monthly and lifetime ranks; it never adjusts them.

The "fans online" number in the chat pill comes from `fans_online()`: real fans seen in the last 10 minutes plus about 30% of the seeded fans, in a rotation that changes every hour.

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

- [ ] Before the listening quest goes live: `CRON_SECRET` set in Vercel, MetaBrainz commercial tier approved by Amanda, distributor check done.

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
