# ReadyToTalk App

TanStack Start running on Cloudflare Workers with:

- Better Auth
- Drizzle ORM
- Cloudflare D1
- Username/password sign-in

## Local development

1. Install dependencies:

```bash
pnpm install
```

2. Create a local auth secret:

```bash
cp .dev.vars.example .dev.vars
```

Set both values in `.dev.vars`:

- `BETTER_AUTH_SECRET`
- `GOOGLE_MAPS_API_KEY`

3. Apply the local D1 migration:

```bash
pnpm run db:migrate:local
```

4. Start the app:

```bash
pnpm run dev
```

The auth API is mounted at `/api/auth/*`. After sign-in, the app requests location access, loads nearby Google Places, saves the user's mood/intent onboarding state, and moves them into a place view with a D1-backed ready count.

## Database workflow

Generate a new Drizzle migration:

```bash
pnpm run db:generate
```

Apply migrations to the local D1 database:

```bash
pnpm run db:migrate:local
```

Apply migrations to the remote D1 database:

```bash
pnpm run db:migrate:remote
```

## Cloudflare setup

`wrangler.jsonc` already includes the D1 binding:

- Binding: `DB`
- Local migration directory: `./drizzle`

Before deploying, create a real D1 database and either add its id to `wrangler.jsonc` or target the binding/database name through Wrangler. You also need to set the auth secret:

```bash
wrangler secret put BETTER_AUTH_SECRET
```

And the Google Places API key:

```bash
wrangler secret put GOOGLE_MAPS_API_KEY
```

## Verification

Typecheck:

```bash
pnpm run typecheck
```

Production build:

```bash
pnpm run build
```
