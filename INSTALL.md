<div align="center">

# Zola Installation Guide

**Complete setup guide for self-hosting Zola with authentication, storage, and AI models**

![Zola Installation](./public/cover_zola.webp)

[Back to Main README](./README.md)

</div>

---

## Table of Contents

- [Quick Start with Docker](#quick-start-with-docker)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Authentication Setup](#authentication-setup)
- [Database Configuration](#database-configuration)
- [Storage Configuration](#storage-configuration)
- [Ollama Setup](#ollama-setup-local-ai-models)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Production Deployment](#production-deployment)
- [Configuration Options](#configuration-options)
- [Troubleshooting](#troubleshooting)

---

## Quick Start with Docker

Docker Compose is the recommended way to run Zola. It starts Postgres and MinIO, applies the database migrations, and runs the app — no Node.js toolchain and no manual database setup.

```bash
git clone https://github.com/SilkePilon/zola.git
cd zola

cp .env.example .env.local

# Generate the three required secrets
{
  echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
  echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
  echo "CSRF_SECRET=$(openssl rand -hex 32)"
} >> .env.local

docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and create an account with email and password. Add AI provider keys under **Settings > API Keys**.

Nothing else is required — social sign-in, AI provider env vars, and Ollama are all optional. The rest of this guide covers those, plus production concerns.

| Service | URL | Purpose |
|---|---|---|
| Zola | http://localhost:3000 | The app |
| MinIO console | http://localhost:9001 | Uploaded file browser (login `zola` / `zola-minio-secret`) |
| Postgres | localhost:5432 | Database (`zola` / `zola`) |

```bash
docker compose logs -f zola    # tail app logs
docker compose down            # stop
docker compose down -v         # stop and delete all data
docker compose up -d --build   # rebuild after changing code
```

> [!WARNING]
> The default Postgres and MinIO passwords in `docker-compose.yml` are for local use only. Change them before exposing Zola to a network — see [Production Deployment](#production-deployment).

---

## Prerequisites

**For Docker (recommended):**

- Docker with Compose v2 — check with `docker compose version`
- Git

**Additionally, for local development:**

- Node.js 18.x or later
- npm

**Optional:**

- API keys for AI providers (OpenAI, Anthropic, Google, …) — users can also add their own in Settings
- Ollama, for local AI models

## Environment Setup

### Step 1: Create Environment File

```bash
cp .env.example .env.local
```

`.env.example` documents every variable. Docker Compose reads `.env.local` and refuses to start without it.

### Step 2: Generate the Required Secrets

Three secrets are required — the app throws on startup if any is missing:

| Variable | Purpose | Generate with |
|---|---|---|
| `ENCRYPTION_KEY` | Encrypts user API keys at rest (AES-256-GCM). Must be exactly 32 bytes, base64-encoded. | `openssl rand -base64 32` |
| `BETTER_AUTH_SECRET` | Signs sessions. | `openssl rand -hex 32` |
| `CSRF_SECRET` | Signs CSRF tokens. | `openssl rand -hex 32` |

Generate all three at once:

```bash
{
  echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
  echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
  echo "CSRF_SECRET=$(openssl rand -hex 32)"
} >> .env.local
```

This appends, so the keys now appear twice — once empty from `.env.example`, once with a value. The last value wins, so it works either way; tidy the file by hand if you prefer.

No OpenSSL? Equivalent commands:

```bash
# Node.js
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('BETTER_AUTH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Python
python -c "import base64, secrets; print('ENCRYPTION_KEY=' + base64.b64encode(secrets.token_bytes(32)).decode())"
python -c "import secrets; print('BETTER_AUTH_SECRET=' + secrets.token_hex(32))"
```

> [!IMPORTANT]
> Back up `ENCRYPTION_KEY` and reuse it across every environment. Losing or changing it makes all stored user API keys permanently undecryptable. Changing `BETTER_AUTH_SECRET` signs every user out.

### Step 3: Everything Else Is Optional

- **`BETTER_AUTH_URL`** — defaults to `http://localhost:3000`. Set it to your real domain in production; it builds the OAuth callback URLs.
- **Social sign-in** — see [Authentication Setup](#authentication-setup). Email/password works with none of it set.
- **AI provider keys** — set them to preconfigure a provider, or let users add their own in Settings (encrypted at rest).
- **Infrastructure vars** (`DATABASE_URL`, `MINIO_*`) — **ignored under Docker**, which overrides them with the compose network's hostnames. They only matter for `npm run dev`.

---

## Authentication Setup

Zola uses [Better Auth](https://www.better-auth.com) for authentication. Three ways in:

- **Email and password** — always enabled, no configuration required
- **Google OAuth** — optional, enabled by setting `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- **GitHub OAuth** — optional, enabled by setting `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`

Plus an automatic anonymous/guest session for users who haven't signed in — no dashboard toggle needed for guest mode, it's on by default. When a guest later signs in or signs up, their existing chats are reassigned to the new account.

Each social provider is only registered when **both** of its variables are set, and the sign-in UI hides providers that aren't configured. Set neither and users get an email/password form only — a valid setup, and the fastest way to run Zola locally.

Email verification is **off**: Zola ships no transactional email sender, so requiring verification would lock every new account out. If you add a mail provider, turn it on via `emailAndPassword.requireEmailVerification` in `lib/auth.ts`.

### Google OAuth Setup (optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth Client ID**
5. Configure the OAuth consent screen if prompted
6. Select application type: **Web application**
7. Add **Authorized redirect URIs**:
   ```
   http://localhost:3000/api/auth/callback/google
   https://your-production-domain.com/api/auth/callback/google
   ```
8. Click **Create** and copy the **Client ID** and **Client Secret** into `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env.local`
9. Set `BETTER_AUTH_URL` to your app's base URL (`http://localhost:3000` locally, your real domain in production) — Better Auth uses this to build the OAuth callback URL

### GitHub OAuth Setup (optional)

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** > **New OAuth App**
3. Set **Homepage URL** to your app's base URL (`http://localhost:3000` locally)
4. Set **Authorization callback URL**:
   ```
   http://localhost:3000/api/auth/callback/github
   ```
   A GitHub OAuth app accepts only one callback URL, so register separate apps for local development and production.
5. Click **Register application**, then **Generate a new client secret**
6. Copy the **Client ID** and **Client Secret** into `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` in `.env.local`

> **Note:** `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` are for sign-in and are unrelated to the optional `GITHUB_TOKEN` used by developer tools.

---

## Database Configuration

Zola's schema is defined in `lib/db/schema.ts` (app tables) and `lib/db/auth-schema.ts` (Better Auth's tables), managed by [Drizzle ORM](https://orm.drizzle.team).

### Under Docker (nothing to do)

The `migrate` service applies all migrations before the app starts, so a fresh `docker compose up` gives you a ready schema. It re-runs on every `up` and is a no-op when the schema is already current.

### Running Migrations Yourself

Only needed for `npm run dev`, or when pointing `DATABASE_URL` at a Postgres you already run (13+):

```bash
docker compose up -d postgres   # or use your own instance
npm run db:migrate
```

One command creates both the app tables and Better Auth's tables.

### Changing the Schema

Edit `lib/db/schema.ts` (or `lib/db/auth-schema.ts`), then:

```bash
npm run db:generate   # writes a new migration to lib/db/migrations/
npm run db:migrate    # applies it
```

Commit the generated migration — the Docker `migrate` service applies whatever is in that directory.

### BYOK (Bring Your Own Key)

BYOK lets users store their own AI provider API keys, encrypted at rest with AES-256-GCM under your `ENCRYPTION_KEY`. It's enabled automatically — `ENCRYPTION_KEY` is already required for the app to boot (see [Environment Setup](#environment-setup)). Users add their keys in **Settings > API Keys**.

---

## Storage Configuration

Zola stores file attachments (images, documents, PDFs) in MinIO, an S3-compatible object store, provisioned as the `minio` service in `docker-compose.yml`.

### Quick Setup

1. Start MinIO: `docker compose up -d minio`
2. Set the MinIO env vars in `.env.local` (see the Environment Setup section above) — `MINIO_ENDPOINT`/`MINIO_PORT` for server-side access, and `MINIO_PUBLIC_URL` for the browser-reachable base URL used in uploaded file links (override this to your real domain in production; `localhost:9000` only works when the app and browser are on the same machine)

The `chat-attachments` bucket and its public-read policy are created automatically on first upload — no manual bucket creation step, unlike the old Supabase Storage setup.

### File Upload Limits

Configure in `lib/config.ts`:

```typescript
export const DAILY_FILE_UPLOAD_LIMIT = 5 // Uploads per day for non-premium users
```
## Ollama Setup (Local AI Models)

Ollama runs AI models locally — free, private, no API keys. Zola detects your models automatically.

### With Docker (recommended)

`docker-compose.ollama.yml` is an **override** file: it adds an Ollama container and points Zola at it, reusing Postgres, MinIO, and migrations from the main compose file. Always pass both files, base first:

```bash
docker compose -f docker-compose.yml -f docker-compose.ollama.yml up -d

# Pull a model
docker compose -f docker-compose.yml -f docker-compose.ollama.yml exec ollama ollama pull llama3.2
```

### With Ollama on the Host

Already running Ollama outside Docker? Point the container at it by adding this to `.env.local`:

```bash
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

Install Ollama with:

```bash
# macOS and Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: download from https://ollama.ai/download
```

Then `ollama pull llama3.2`.

### Disabling Ollama

Ollama is enabled by default in development and disabled in production (avoiding connection errors where no Ollama exists). To disable it in development:

```bash
# .env.local
DISABLE_OLLAMA=true
```

### Recommended Models

| Use case | Models |
|---|---|
| General chat | `llama3.2:3b` (balanced), `gemma2:2b` (fast), `qwen2.5:3b` (multilingual) |
| Coding | `codellama:7b`, `deepseek-coder:6.7b`, `phi3.5:3.8b` |
| Creative writing | `llama3.2:8b`, `mistral:7b` |
| Fastest | `llama3.2:1b`, `gemma2:2b` |

Smaller models (1B–3B) respond faster. Enable GPU acceleration if available, and tune `OLLAMA_NUM_PARALLEL` for concurrency.

---

## Local Development

Only needed if you're changing Zola's code. `npm run dev` does **not** start Postgres or MinIO — run those with Docker.

```bash
git clone https://github.com/SilkePilon/zola.git
cd zola
npm install

cp .env.example .env.local
{
  echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
  echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
  echo "CSRF_SECRET=$(openssl rand -hex 32)"
} >> .env.local

# Start dependencies only
docker compose up -d postgres minio

# Create the schema, then run the dev server
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The default `DATABASE_URL` and `MINIO_*` values in `.env.example` already point at those containers.

### Scripts

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build (webpack)
npm run start        # Run the production build
npm run lint         # ESLint
npm run type-check   # TypeScript, no emit
npm run db:generate  # Generate a migration from schema changes
npm run db:migrate   # Apply migrations
npm run db:studio    # Browse the database
```

---

## Docker Deployment

### How the Stack Fits Together

`docker-compose.yml` defines four services:

| Service | Role |
|---|---|
| `postgres` | Database. Data persists in the `zola-postgres-data` volume. |
| `minio` | S3-compatible store for file attachments. Volume `zola-minio-data`. |
| `migrate` | Applies database migrations, then exits. The app waits for it to succeed. |
| `zola` | The app. Waits for all three above. |

Because `migrate` runs first, `docker compose up` on a clean machine produces a working schema with no manual step. It re-runs on every `up` and is a no-op when already current.

### Configuration

- **Secrets** come from `.env.local` via `env_file`. Compose won't start without that file.
- **Infrastructure vars** (`DATABASE_URL`, `MINIO_ENDPOINT`, …) are set in `docker-compose.yml` and **override** `.env.local` — inside the compose network, services resolve by service name, not `localhost`.

That split means the same `.env.local` works for both `docker compose up` and `npm run dev`.

### Build-Time Placeholders

`next build` imports modules that throw when `ENCRYPTION_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `CSRF_SECRET`, or `MINIO_*` are unset, so the `builder` stage sets dummy values. They are not secrets and never reach the final image — the `runner` stage starts from a clean base and gets real values at runtime. None are `NEXT_PUBLIC_*`, so nothing is baked into the client bundle.

### Commands

```bash
docker compose up -d            # start
docker compose up -d --build    # rebuild after code changes
docker compose logs -f zola     # tail app logs
docker compose ps               # service health
docker compose down             # stop, keep data
docker compose down -v          # stop and delete all data
```

---

## Production Deployment

> [!WARNING]
> Zola requires Postgres and MinIO. Vercel and similar platforms run only the Next.js app — you must supply managed Postgres and S3-compatible storage separately and point `DATABASE_URL`/`MINIO_*` at them. A Docker host (VPS, Fly.io, Railway, ECS, Cloud Run) running the full compose stack is the simpler path.

### Checklist

- [ ] Generate **fresh** `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, and `CSRF_SECRET` — never reuse development values
- [ ] Back up `ENCRYPTION_KEY`; losing it makes every stored user API key permanently undecryptable
- [ ] Change the default Postgres and MinIO passwords in `docker-compose.yml`
- [ ] Set `BETTER_AUTH_URL` to your real HTTPS domain
- [ ] Set `MINIO_PUBLIC_URL` to a browser-reachable URL (`localhost:9000` only works on your own machine)
- [ ] Register production OAuth callback URLs (`{BETTER_AUTH_URL}/api/auth/callback/google`, `.../github`)
- [ ] Serve over HTTPS behind a reverse proxy
- [ ] Point `DATABASE_URL` at a production-grade Postgres with backups enabled
- [ ] Set up database and object-storage backups
- [ ] Set up monitoring (Sentry, etc.)

### Attachment Images

`next.config.ts` ships with `images.remotePatterns: []`. To render attachment images through `next/image`, add your storage domain:

```typescript
images: {
  remotePatterns: [{ protocol: "https", hostname: "storage.example.com" }],
}
```

The domain varies per deployment, so this can't ship preconfigured.

---

## Configuration Options

### Application Config

Edit `lib/config.ts`:

```typescript
// Rate limits
export const NON_AUTH_DAILY_MESSAGE_LIMIT = 5
export const AUTH_DAILY_MESSAGE_LIMIT = 1000
export const DAILY_LIMIT_PRO_MODELS = 500

// Uploads per day
export const DAILY_FILE_UPLOAD_LIMIT = 5

// Free models (no authentication required)
export const FREE_MODELS_IDS = ["google:gemini-2.5-pro"]

// Default model
export const MODEL_DEFAULT = "google:gemini-2.5-pro"

// System prompt
export const SYSTEM_PROMPT_DEFAULT = `You are Zola, a thoughtful and clear assistant...`
```

File size limits and allowed types live in `lib/file-handling.ts`.

### Custom Models

Users add custom models in **Settings > Models > Add Custom Model**; they're stored per-user in the `custom_models` table.

Models are otherwise fetched from the [models.dev](https://models.dev) API. To add a provider for everyone, contribute to the [models.dev repository](https://github.com/modelcontextprotocol/models.dev) — no change to this repo is needed.

---

## Troubleshooting

<details>
<summary><strong>Docker: "env file .env.local not found"</strong></summary>

Compose requires it. Create it:

```bash
cp .env.example .env.local
{
  echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
  echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
  echo "CSRF_SECRET=$(openssl rand -hex 32)"
} >> .env.local
```

</details>

<details>
<summary><strong>Container exits immediately / app won't start</strong></summary>

Symptoms: `zola` container starts then stops.

The app throws on startup if a required variable is missing — Postgres, Better Auth, and MinIO are hard requirements with no reduced-functionality fallback.

1. Check the logs: `docker compose logs zola` — the error names the missing variable
2. Confirm `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, and `CSRF_SECRET` are all set in `.env.local`
3. `ENCRYPTION_KEY` must decode to exactly 32 bytes (`openssl rand -base64 32`)
4. Check whether port 3000 is already in use

</details>

<details>
<summary><strong>Database connection fails</strong></summary>

1. Check Postgres health: `docker compose ps postgres`
2. Check its logs: `docker compose logs postgres`
3. Confirm migrations ran: `docker compose logs migrate` (should end "migrations applied successfully")
4. For `npm run dev`, verify `DATABASE_URL` points at a reachable instance and run `npm run db:migrate`

</details>

<details>
<summary><strong>Can't sign in / no sign-in buttons</strong></summary>

Email and password sign-in is always available and needs no configuration — if the form is missing entirely, the app failed to start (see above).

Google and GitHub buttons appear **only** when both env vars for that provider are set. If a button is missing:

1. Confirm both `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (or the GitHub pair) are in `.env.local`
2. Restart: `docker compose up -d` — provider config is read at startup
3. Check `curl http://localhost:3000/api/auth-providers` — it reports what the server actually registered

OAuth failing after redirect usually means the callback URL registered with the provider doesn't match `{BETTER_AUTH_URL}/api/auth/callback/{provider}`.

</details>

<details>
<summary><strong>AI models not responding</strong></summary>

1. Verify API keys are correct and have credits
2. Check the provider's status page
3. Test with a free model first: `google:gemini-2.5-pro`
4. Check the browser console for errors
5. Check for rate limiting (429 errors)

</details>

<details>
<summary><strong>Ollama models not detected</strong></summary>

1. Confirm Ollama is running: `curl http://localhost:11434/api/tags`
2. Pull at least one model: `ollama pull llama3.2`
3. In Docker, `OLLAMA_BASE_URL` must be `http://ollama:11434` (compose) or `http://host.docker.internal:11434` (host Ollama) — never `localhost`
4. Check whether `DISABLE_OLLAMA=true` is set
5. Restart Zola if models were added after startup

</details>

<details>
<summary><strong>File uploads not working</strong></summary>

1. Check MinIO health: `docker compose ps minio`
2. Ensure the user is signed in — uploads require a session
3. Check file size and type limits in `lib/file-handling.ts`
4. Open the MinIO console at [http://localhost:9001](http://localhost:9001) and confirm the `chat-attachments` bucket has objects

The bucket and its public-read policy are created automatically on first upload.

</details>

<details>
<summary><strong>Uploaded images don't render</strong></summary>

Set `MINIO_PUBLIC_URL` to a URL your browser can reach, and add the domain to `images.remotePatterns` in `next.config.ts`. See [Production Deployment](#production-deployment).

</details>

<details>
<summary><strong>BYOK (user API keys) not working</strong></summary>

1. Verify `ENCRYPTION_KEY` is set and decodes to 32 bytes
2. If it changed, previously stored keys can no longer be decrypted — users must re-enter them
3. Ensure the user is signed in

</details>

<details>
<summary><strong>Build errors</strong></summary>

1. Delete `.next` and `node_modules`, then `npm install`
2. Check Node.js is 18.x or later
3. Clear the npm cache: `npm cache clean --force`

</details>

<details>
<summary><strong>"models.dev API failed"</strong></summary>

1. Check internet access: `curl https://models.dev/api.json`
2. Check whether a corporate firewall blocks it
3. The cache retries after 5 minutes

</details>

### Debug Mode

```bash
# .env.local
DEBUG=zola:*
NODE_ENV=development
```

### Getting Help

1. Search [GitHub Issues](https://github.com/SilkePilon/zola/issues) and [Discussions](https://github.com/SilkePilon/zola/discussions)
2. Opening an issue? Include the full error, your OS and deployment method, steps to reproduce, and your config **with secrets removed**

---

## Additional Resources

- [Main README](./README.md) - Overview and features
- [models.dev](https://models.dev) - AI model registry
- [Drizzle ORM Docs](https://orm.drizzle.team) - Database schema and queries
- [Better Auth Docs](https://www.better-auth.com) - Authentication
- [Vercel AI SDK](https://sdk.vercel.ai) - AI integration
- [Next.js Docs](https://nextjs.org/docs) - Framework documentation
- [shadcn/ui](https://ui.shadcn.com) - UI components

---

## Community & Support

- **GitHub Issues** - [Report bugs](https://github.com/SilkePilon/zola/issues)
- **GitHub Discussions** - [Ask questions](https://github.com/SilkePilon/zola/discussions)
- **Discord** - Coming soon

---

## License

Zola is open-source software licensed under the [Apache License 2.0](LICENSE).

---

<div align="center">

[Back to Top](#zola-installation-guide)

Made with care by the open-source community

[Back to Main README](./README.md)

</div>
