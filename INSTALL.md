<div align="center">

# Zola Installation Guide

**Complete setup guide for self-hosting Zola with authentication, storage, and AI models**

![Zola Installation](./public/cover_zola.webp)

[Back to Main README](./README.md)

</div>

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Database Configuration](#database-configuration)
- [Authentication Setup](#authentication-setup)
- [Storage Configuration](#storage-configuration)
- [Ollama Setup](#ollama-setup-local-ai)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18.x or later - Runtime environment
- npm or yarn (latest) - Package manager
- Git (latest) - Version control
- Docker and Docker Compose - For self-hosted Postgres, MinIO, and (optionally) the app itself
- API Keys - For AI providers like OpenAI, Anthropic, Google, etc.
- Ollama (optional) - For running local AI models

## Environment Setup

### Step 1: Create Environment File

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

### Step 2: Configure Environment Variables

Edit `.env.local` with your credentials:

#### Database (Required for full features)

```bash
DATABASE_URL=postgres://zola:zola@localhost:5432/zola
BETTER_AUTH_SECRET=your_32_character_random_string
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=zola
MINIO_SECRET_KEY=zola-minio-secret
MINIO_BUCKET=chat-attachments
MINIO_PUBLIC_URL=http://localhost:9000
```

#### Security (Required)

```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CSRF_SECRET=your_csrf_secret_key

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=your_encryption_key  # Required for BYOK feature
```

#### AI Provider API Keys (Optional - choose what you need)

````bash
# OpenAI (GPT-4, GPT-3.5, etc.)
OPENAI_API_KEY=sk-...

# Anthropic (Claude models)
ANTHROPIC_API_KEY=sk-ant-...

# Google (Gemini models)
GOOGLE_GENERATIVE_AI_API_KEY=...

# Mistral AI
MISTRAL_API_KEY=...
### Generating Security Keys

#### CSRF Secret

The `CSRF_SECRET` protects against Cross-Site Request Forgery attacks. Generate a secure random string:

<table>
<tr>
<td width="33%">

**Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
````

</td>
<td width="33%">

**OpenSSL**

```bash
openssl rand -hex 32
```

</td>
#### Encryption Key (for BYOK)

The `ENCRYPTION_KEY` encrypts user API keys in the database (AES-256-GCM). This enables the Bring Your Own Key feature.

Using Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Using OpenSSL:

```bash
openssl rand -base64 32
```

Using Python:

```bash
python -c "import base64, secrets; print(base64.b64encode(secrets.token_bytes(32)).decode())"
```

## Add to `.env.local`:

## Authentication Setup

Zola uses [Better Auth](https://www.better-auth.com) for authentication: Google OAuth for real accounts, and an automatic anonymous/guest session for users who haven't signed in — no dashboard toggle needed for guest mode, it's on by default.

### Google OAuth Setup

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

---

## Database Configuration

Zola's schema is defined in `lib/db/schema.ts` (app tables) and `lib/db/auth-schema.ts` (Better Auth's tables), managed by [Drizzle ORM](https://orm.drizzle.team).

### Quick Setup

1. Start Postgres: `docker compose up -d postgres` (or point `DATABASE_URL` at any Postgres 13+ instance you already run)
2. Apply the schema: `npm run db:migrate`

That's it — both the app tables and Better Auth's tables are created by this one command. To change the schema, edit `lib/db/schema.ts`, run `npm run db:generate` to create a new migration file under `lib/db/migrations/`, then `npm run db:migrate` again.

The `CSRF_SECRET` is used to protect your application against Cross-Site Request Forgery attacks. You need to generate a secure random string for this value. Here are a few ways to generate one:

#### Using Node.js

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Using OpenSSL

```bash
openssl rand -hex 32
```

#### Using Python

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the generated value and add it to your `.env.local` file as the `CSRF_SECRET` value.

### BYOK (Bring Your Own Key) Setup

Zola supports BYOK functionality, allowing users to securely store and use their own API keys for AI providers. To enable this feature, you need to configure an encryption key for secure storage of user API keys.

#### Generating an Encryption Key

The `ENCRYPTION_KEY` is used to encrypt user API keys before storing them in the database. Generate a 32-byte base64-encoded key:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Using OpenSSL
openssl rand -base64 32

# Using Python
python -c "import base64, secrets; print(base64.b64encode(secrets.token_bytes(32)).decode())"
```

Add the generated key to your `.env.local` file:

```bash
# Required for BYOK functionality
ENCRYPTION_KEY=your_generated_base64_encryption_key
```

**Important**:

- Keep this key secure and backed up - losing it will make existing user API keys unrecoverable
- Use the same key across all your deployment environments
- The key must be exactly 32 bytes when base64 decoded

With BYOK enabled, users can securely add their own API keys through the settings interface, giving them access to AI models using their personal accounts and usage limits.

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

Ollama allows you to run AI models locally on your machine. Zola has built-in support for Ollama with automatic model detection.

### Installing Ollama

#### macOS and Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### Windows

Download and install from [ollama.ai](https://ollama.ai/download)

#### Docker

```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

### Setting up Models
---

## Local Development

### Quick Start

```bash
# Clone the repository
git clone https://github.com/SilkePilon/zola.git
cd zola

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Development Scripts

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

### Development Tips

- **Hot Reload**: Changes are automatically reflected in the browser
- **Type Safety**: TypeScript catches errors before runtime
- **Turbopack**: Fast bundling with Next.js 15
- **Error Overlay**: Helpful error messages in development

### Project Structure
### Option 1: Single Container

A `Dockerfile` is included in the repository:
│   ├── components/        # Page-specific components
│   └── lib/              # Client-side utilities
├── components/            # Shared components
**Build and run:**g remote Ollama

#### Models not appearing

1. Refresh the models list in Zola settings
2. Check Ollama has models: `ollama list`
3. Restart Zola if models were added after startup

#### Performance optimization

1. Use smaller models for faster responses (1B-3B parameters)
2. Enable GPU acceleration if available
3. Adjust Ollama's `OLLAMA_NUM_PARALLEL` environment variable

## Disabling Ollama

Ollama is automatically enabled in development and disabled in production. If you want to disable it in development, you can use an environment variable:

### Environment Variable

Add this to your `.env.local` file:

```bash
# Disable Ollama in development
DISABLE_OLLAMA=true
```

### Note

- In **production**, Ollama is disabled by default to avoid connection errors
- In **development**, Ollama is enabled by default for local AI model testing
- Use `DISABLE_OLLAMA=true` to disable it in development

### Recommended Models by Use Case

#### General Chat

- `llama3.2:3b` - Good balance of quality and speed
- `gemma2:2b` - Fast and efficient
- `qwen2.5:3b` - Excellent multilingual support

#### Coding

- `codellama:7b` - Specialized for code generation
- `deepseek-coder:6.7b` - Strong coding capabilities
- `phi3.5:3.8b` - Good for code explanation

#### Creative Writing

- `llama3.2:8b` - Better for creative tasks
- `mistral:7b` - Good instruction following

#### Fast Responses

- `llama3.2:1b` - Ultra-fast, basic capabilities
- `gemma2:2b` - Quick and capable

## Local Installation

### macOS / Linux

```bash
# Clone the repository
git clone https://github.com/SilkePilon/zola.git
cd zola

# Install dependencies
npm install

# Run the development server
npm run dev
```

### Windows

```bash
# Clone the repository
git clone https://github.com/SilkePilon/zola.git
cd zola

# Install dependencies
npm install

### Option 2: Docker Compose (Standard)

A `docker-compose.yml` file is included. **Run with:**ase

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies with clean slate
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy all project files
COPY . .

# Set Next.js telemetry to disabled
ENV NEXT_TELEMETRY_DISABLED 1

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Set environment variables
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
### Option 3: Docker Compose with Ollama (Recommended)

The **complete setup** with both Zola and Ollama is in `docker-compose.ollama.yml`:

```bash
# Start both services
docker-compose -f docker-compose.ollama.yml up -d

# View logs
docker-compose -f docker-compose.ollama.yml logs -f

# Stop everything
docker-compose -f docker-compose.ollama.yml down
```

What's included:
- Zola web interface
- Ollama server with GPU support (if available)
- Automatic model pulling (llama3.2:3b by default)
- Health checks for both services
- Proper networking (Zola to Ollama communication)
- Volume persistence for models
- Ready to use at [http://localhost:3000](http://localhost:3000)

**Customize models:**

Edit `docker-compose.ollama.yml` and change the `OLLAMA_MODELS` environment variable:

```yaml
environment:
  - OLLAMA_MODELS=llama3.2:3b,gemma2:2b,qwen2.5:3b,codellama:7b
```
---

## Production Deployment

### Deploy to Vercel (Recommended)

Vercel is the easiest way to deploy Zola:

#### Option A: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/SilkePilon/zola)

#### Option B: Manual Deploy

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click **Import Project**
4. Select your repository
5. Configure environment variables:
   - Add all variables from `.env.local`
   - Set `NEXT_PUBLIC_VERCEL_URL` to your domain
6. Click **Deploy**

#### Option C: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Self-Hosted Production

### Common Issues

<details>
<summary><strong>Database connection fails</strong></summary>

Symptoms: "Database connection failed" errors

**Solutions**:
1. Verify `DATABASE_URL` in `.env.local` points at a reachable Postgres instance
2. Check the Postgres container is healthy: `docker compose ps postgres`
3. Confirm migrations have been applied: `npm run db:migrate`
4. Check Postgres logs: `docker compose logs postgres`

</details>

<details>
<summary><strong>AI models not responding</strong></summary>

Symptoms: Empty responses, timeout errors

**Solutions**:
1. Verify API keys are correct and have sufficient credits
2. Check provider status pages (OpenAI, Anthropic, etc.)
3. Test with a free model first: `google:gemini-2.5-pro`
4. Check browser console for error messages
5. Verify model ID matches provider's documentation
6. Check for rate limiting (429 errors)

</details>

<details>
<summary><strong>Ollama models not detected</strong></summary>

Symptoms: No local models appear in selector

**Solutions**:
1. Ensure Ollama is running: `ollama serve`
2. Test Ollama API: `curl http://localhost:11434/api/tags`
3. Verify `OLLAMA_BASE_URL` in `.env.local` (default: `http://localhost:11434`)
4. Check if `DISABLE_OLLAMA=true` is set
5. Pull at least one model: `ollama pull llama3.2`
6. Restart Zola after adding models

</details>

<details>
<summary><strong>Docker container exits immediately</strong></summary>

Symptoms: Container starts then stops

**Solutions**:
1. Check logs: `docker logs <container_id>`
2. Verify all required env vars are set
3. Check if port 3000 is already in use
4. Ensure `.env.local` is not being used (use `-e` flags or `.env` file)
5. Confirm `DATABASE_URL`, `BETTER_AUTH_SECRET`, and MinIO env vars are all set — the app throws on startup if any are missing (Postgres/Better Auth/MinIO are hard requirements, there's no reduced-functionality mode to fall back to)

</details>

<details>
<summary><strong>File uploads not working</strong></summary>

Symptoms: Upload button doesn't work or files don't save

**Solutions**:
1. Verify the `minio` container is running and healthy: `docker compose ps minio`
2. Check `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` in `.env.local` match `docker-compose.yml`'s `minio` service credentials
3. Ensure user is authenticated (uploads require a session)
4. Check file size limits (default: 10MB per file) and allowed file types (`lib/file-handling.ts`)
5. Check the MinIO console at `http://localhost:9001` to confirm the `chat-attachments` bucket exists and has objects

</details>

<details>
<summary><strong>BYOK (user API keys) not working</strong></summary>

Symptoms: Can't save API keys in settings

**Solutions**:
1. Verify `ENCRYPTION_KEY` is set in `.env.local`
2. Key must be 32 bytes base64-encoded
3. Check `user_keys` table exists in database
4. Ensure user is authenticated
5. Check browser console for encryption errors

</details>

<details>
<summary><strong>Build errors with Next.js 15</strong></summary>

Symptoms: Build fails with type errors

**Solutions**:
1. Delete `.next` folder and `node_modules`
2. Run `npm install` again
3. Check Node.js version (requires 18.x+)
4. Clear npm cache: `npm cache clean --force`
5. Check TypeScript version: `npm list typescript`

</details>

<details>
<summary><strong>"models.dev API failed" errors</strong></summary>

Symptoms: No models load, console shows API errors

**Solutions**:
1. Check internet connection
2. Verify models.dev is accessible: `curl https://models.dev/api.json`
3. Check if corporate firewall blocks the API
4. Try setting custom `MODELS_DEV_URL` if using mirror
5. Cache will retry after 5 minutes

</details>

### Getting Help

Still having issues? Here's how to get help:

1. **Check existing issues**: [GitHub Issues](https://github.com/SilkePilon/zola/issues)
2. **Search discussions**: [GitHub Discussions](https://github.com/SilkePilon/zola/discussions)
3. **Create new issue**: Include:
   - Error messages (full stack trace)
   - Environment (OS, Node version, deployment platform)
   - Steps to reproduce
   - Configuration (without sensitive keys!)
4. **Join community**: Discord (coming soon)

### Debug Mode

Enable verbose logging:

```bash
# In .env.local
DEBUG=zola:*
NODE_ENV=development
```

Check browser console and terminal for detailed logs.

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
- **Twitter** - [@zola_chat](https://twitter.com/zola_chat)

---

## License

Zola is open-source software licensed under the [Apache License 2.0](LICENSE).

---

<div align="center">

[Back to Top](#zola-installation-guide)

Made with care by the open-source community

[Back to Main README](./README.md)

</div>TTPS
- [ ] Configure CORS if needed
- [ ] Confirm `DATABASE_URL` points at a production-grade Postgres instance with backups enabled
- [ ] Set up monitoring (Sentry, LogRocket, etc.)
- [ ] Configure backups for database

### Deployment Platforms

Zola works on various platforms:

- Vercel - Recommended, zero-config deployment
- Netlify - Requires build settings configuration
- Railway - Good Docker support
- Fly.io - Global edge deployment
- AWS - Use AWS Amplify or ECS
- Google Cloud - Use Cloud Run
- Azure - Use App Service
- DigitalOcean - Use App Platform
- Self-hosted - Any VPS with Node.js

---

## Configuration Options

### Application Config

Edit `lib/config.ts` to customize:

```typescript
// Rate limits
export const NON_AUTH_DAILY_MESSAGE_LIMIT = 5
export const AUTH_DAILY_MESSAGE_LIMIT = 1000
export const DAILY_LIMIT_PRO_MODELS = 500

// Free models (no authentication required)
export const FREE_MODELS_IDS = [
  "google:gemini-2.5-pro",
]

// Default model
export const MODEL_DEFAULT = "google:gemini-2.5-pro"

// System prompt
export const SYSTEM_PROMPT_DEFAULT = `You are Zola, a thoughtful and clear assistant...`
```

### Custom Models

Users can add custom models through the UI:
1. Go to **Settings** > **Models**
2. Click **Add Custom Model**
3. Fill in model details
4. Models are stored per-user in `custom_models` table

### Provider Configuration

Models are fetched from [models.dev](https://models.dev) API. To add new providers globally, contribute to the [models.dev repository](https://github.com/modelcontextprotocol/models.dev).

---

## Troubleshooting
      - MISTRAL_API_KEY=${MISTRAL_API_KEY}
    restart: unless-stopped
```

Run with Docker Compose:

```bash
# Start the services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the services
docker-compose down
```

### Option 3: Docker Compose with Ollama (Recommended for Local AI)

For a complete setup with both Zola and Ollama running locally, use the provided `docker-compose.ollama.yml`:

```bash
# Start both Zola and Ollama services
docker-compose -f docker-compose.ollama.yml up -d

# View logs
docker-compose -f docker-compose.ollama.yml logs -f

# Stop the services
docker-compose -f docker-compose.ollama.yml down
```

This setup includes:

- **Ollama service** with GPU support (if available)
- **Automatic model pulling** (llama3.2:3b by default)
- **Health checks** for both services
- **Proper networking** between Zola and Ollama
- **Volume persistence** for Ollama models

The Ollama service will be available at `http://localhost:11434` and Zola will automatically detect all available models.

To customize which models are pulled, edit the `docker-compose.ollama.yml` file and modify the `OLLAMA_MODELS` environment variable:

```yaml
environment:
  - OLLAMA_MODELS=llama3.2:3b,gemma2:2b,qwen2.5:3b
```

## Production Deployment

### Deploy to Vercel

The easiest way to deploy Zola is using Vercel:

1. Push your code to a Git repository (GitHub, GitLab, etc.)
2. Import the project into Vercel
3. Configure your environment variables
4. Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Self-Hosted Production

For a self-hosted production environment, you'll need to build the application and run it:

```bash
# Build the application
npm run build

# Start the production server
npm start
```

## Configuration Options

You can customize various aspects of Zola by modifying the configuration files:

- `app/lib/config.ts`: Configure AI models, daily message limits, etc.
- `.env.local`: Set environment variables and API keys

## Troubleshooting

### Common Issues

1. **Database connection fails**

   - Check your `DATABASE_URL` and that the Postgres container is running
   - Confirm migrations have been applied: `npm run db:migrate`

2. **AI models not responding**

   - Verify your API keys for OpenAI/Mistral
   - Check that the models specified in config are available

3. **Docker container exits immediately**
   - Check logs using `docker logs <container_id>`
   - Ensure all required environment variables are set

## Community and Support

- GitHub Issues: Report bugs or request features
- GitHub Discussions: Ask questions and share ideas

## License

Apache License 2.0
$$
