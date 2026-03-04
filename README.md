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

3. Apply the local D1 migration:

```bash
pnpm run db:migrate:local
```

4. Start the app:

```bash
pnpm run dev
```

The auth API is mounted at `/api/auth/*`, and the home route renders the sign-in/sign-up screen.

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

## Verification

Typecheck:

```bash
pnpm run typecheck
```

Production build:

```bash
pnpm run build
```
