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
- Supabase Account - For authentication and database (optional for basic use)
- API Keys - For AI providers like OpenAI, Anthropic, Google, etc.
- Ollama (optional) - For running local AI models

Note: You can run Zola without Supabase for basic functionality, but you'll lose authentication, file uploads, and user preferences.

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
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE=your_supabase_service_role_key
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

Zola supports multiple authentication methods through Supabase.

### Google OAuth Setup

#### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth Client ID**
5. Configure the OAuth consent screen if prompted
6. Select application type: **Web application**
7. Add **Authorized redirect URIs**:
   ```
   https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback
   ```
8. Click **Create** and save the **Client ID** and **Client Secret**

#### Step 2: Configure in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Authentication** > **Providers**
3. Find **Google** and toggle it on
4. Paste your **Client ID** and **Client Secret**
5. Click **Save**

#### Step 3: Add Production Redirect URL

For production deployments (e.g., Vercel), you need to add your production domain to the authorized redirect URLs:

1. Go back to **Google Cloud Console** > **Credentials**
2. Edit your OAuth 2.0 Client ID
3. Add your production redirect URI:
   ```
   https://zola.silkepilon.dev/auth/callback
   ```
4. Click **Save**

5. In **Supabase Dashboard** > **Authentication** > **URL Configuration**:

   - Add `https://zola.silkepilon.dev` to **Redirect URLs**
   - Set **Site URL** to `https://zola.silkepilon.dev`

6. In your Vercel deployment, ensure environment variable is set:
   ```
   NEXT_PUBLIC_SITE_URL=https://zola.silkepilon.dev
   ```

This ensures that after authentication, users are redirected back to your production domain instead of localhost.

### Guest Mode Setup

Enable anonymous sign-ins for users to try Zola without creating an account:

1. Go to **Supabase Dashboard** > **Authentication** > **Providers**
2. Scroll to **Anonymous sign-ins**
3. Toggle **Enable anonymous sign-ins** to **ON**

---

## Database Configuration

### Quick Setup

Zola includes a complete database schema in `supabase/schema.sql`.

#### Method 1: Use the Provided Schema (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/schema.sql`
4. Paste and run the SQL script
5. Done! All tables, triggers, and policies are created

#### Method 2: Manual Setup

If you prefer to create tables manually, here's the schema:

### Email Authentication (Optional)

Supabase supports email/password authentication out of the box:

1. Already enabled by default in Supabase
2. Users can sign up with email and password
3. Configure email templates in **Authentication** > **Email Templates**

### Additional Providers

Supabase supports many OAuth providers:

- GitHub, GitLab, Bitbucket
- Facebook, Twitter, Discord
- Azure, Apple, LinkedIn
- And more...

Configure them similarly to Google OAuth in the **Authentication** > **Providers** section.

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

#### Google OAuth Authentication

1. Go to your Supabase project dashboard
2. Navigate to Authentication > Providers
3. Find the "Google" provider
4. Enable it by toggling the switch
5. Configure the Google OAuth credentials:
   - You'll need to set up OAuth 2.0 credentials in the Google Cloud Console
   - Add your application's redirect URL: https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback
   - Get the Client ID and Client Secret from Google Cloud Console
   - Add these credentials to the Google provider settings in Supabase

Here are the detailed steps to set up Google OAuth:

1. Go to the Google Cloud Console
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to Credentials > Create Credentials > OAuth Client ID
5. Configure the OAuth consent screen if you haven't already
6. Set the application type as "Web application"
7. Add these authorized redirect URIs:

- https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback
- http://localhost:3000/auth/callback (for local development)

8. Copy the Client ID and Client Secret
9. Go back to your Supabase dashboard
10. Paste the Client ID and Client Secret in the Google provider settings
11. Save the changes

#### Guest user setup

1. Go to your Supabase project dashboard
2. Navigate to Authentication > Providers
3. Toggle on "Allow anonymous sign-ins"
   -- Custom models table (for user-added models)
   CREATE TABLE custom_models (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   name TEXT NOT NULL,
   model_id TEXT NOT NULL,
   provider_id TEXT NOT NULL,
   base_url TEXT,
   context_window INTEGER,
   input_cost DECIMAL(10, 6),
   output_cost DECIMAL(10, 6),
   vision BOOLEAN DEFAULT false,
   tools BOOLEAN DEFAULT false,
   reasoning BOOLEAN DEFAULT false,
   audio BOOLEAN DEFAULT false,
   video BOOLEAN DEFAULT false,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
   );

CREATE INDEX idx_custom_models_user_id ON custom_models(user_id);
CREATE UNIQUE INDEX idx_custom_models_user_model ON custom_models(user_id, provider_id, model_id);

````

Tip: The complete, production-ready schema is in `supabase/schema.sql` with all triggers, indexes, and RLS policies.

### Row Level Security (RLS)

For production, enable RLS policies to secure your data. The schema file includes commented examples:

```sql
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Example: Users can only access their own data
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);
````

Uncomment the RLS section in `supabase/schema.sql` for production deployments.

---

## Storage Configuration

Zola uses Supabase Storage for file uploads (images, documents, PDFs).

### Step 1: Create Storage Buckets

1. Go to **Supabase Dashboard** > **Storage**
2. Click **New bucket**
3. Create two buckets:
   - **Name**: `chat-attachments` | **Public**: ✅ Yes
   - **Name**: `avatars` | **Public**: ✅ Yes

### Step 2: Configure Bucket Policies

The `supabase/schema.sql` file includes storage policies that:

- Allow authenticated users to upload files
- Allow public read access to files
- Allow users to delete their own files
- Restrict file paths to prevent unauthorized access

These policies are automatically created when you run the schema SQL script.

### Manual Policy Setup (Optional)

If you need to create policies manually:

```sql
-- Allow authenticated uploads
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

---

## Ollama Setup (Local AI)
CREATE POLICY "Public can download"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'chat-attachments');

-- Allow users to delete own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### File Upload Limits

Configure in `lib/config.ts`:

```typescript
export const DAILY_FILE_UPLOAD_LIMIT = 5 // Uploads per day for non-premium users
```

message_count INTEGER,
premium BOOLEAN,
profile_image TEXT,
created_at TIMESTAMPTZ DEFAULT NOW(),
last_active_at TIMESTAMPTZ DEFAULT NOW(),
daily_pro_message_count INTEGER,
daily_pro_reset TIMESTAMPTZ,
system_prompt TEXT,
CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE -- Explicit FK definition
);

-- Projects table
CREATE TABLE projects (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name TEXT NOT NULL,
user_id UUID NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chats table
CREATE TABLE chats (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL,
project_id UUID,
title TEXT,
model TEXT,
system_prompt TEXT,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW(),
public BOOLEAN DEFAULT FALSE NOT NULL,
pinned BOOLEAN DEFAULT FALSE NOT NULL,
pinned_at TIMESTAMPTZ NULL,
CONSTRAINT chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
CONSTRAINT chats_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Messages table
CREATE TABLE messages (
id SERIAL PRIMARY KEY, -- Using SERIAL for auto-incrementing integer ID
chat_id UUID NOT NULL,
user_id UUID,
content TEXT,
role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'data')), -- Added CHECK constraint
experimental_attachments JSONB, -- Storing Attachment[] as JSONB
parts JSONB,
created_at TIMESTAMPTZ DEFAULT NOW(),
CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
message_group_id TEXT,
model TEXT
);

-- Chat attachments table
CREATE TABLE chat_attachments (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
chat_id UUID NOT NULL,
user_id UUID NOT NULL,
file_url TEXT NOT NULL,
file_name TEXT,
file_type TEXT,
file_size INTEGER, -- Assuming INTEGER for file size
created_at TIMESTAMPTZ DEFAULT NOW(),
CONSTRAINT fk_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Feedback table
CREATE TABLE feedback (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL,
message TEXT NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User keys table for BYOK (Bring Your Own Key) integration
CREATE TABLE user_keys (
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
provider TEXT NOT NULL,
encrypted_key TEXT NOT NULL,
iv TEXT NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW(),
PRIMARY KEY (user_id, provider)
);

-- User preferences table
CREATE TABLE user_preferences (
user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
layout TEXT DEFAULT 'fullscreen',
prompt_suggestions BOOLEAN DEFAULT true,
show_tool_invocations BOOLEAN DEFAULT true,
show_conversation_previews BOOLEAN DEFAULT true,
multi_model_enabled BOOLEAN DEFAULT false,
hidden_models TEXT[] DEFAULT '{}',
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: keep updated_at in sync for user_preferences
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;

$$
LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_timestamp
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE PROCEDURE update_user_preferences_updated_at();

-- RLS (Row Level Security) Reminder
-- Ensure RLS is enabled on these tables in your Supabase dashboard
-- and appropriate policies are created.
-- Example policies (adapt as needed):
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view their own data." ON users FOR SELECT USING (auth.uid() = id);
-- CREATE POLICY "Users can update their own data." ON users FOR UPDATE USING (auth.uid() = id);
-- ... add policies for other tables (chats, messages, etc.) ...
```

### Storage Setup

Create the buckets `chat-attachments` and `avatars` in your Supabase dashboard:

1. Go to Storage in your Supabase dashboard
2. Click "New bucket" and create two buckets: `chat-attachments` and `avatars`
3. Configure public access permissions for both buckets

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
git clone https://github.com/ibelick/zola.git
cd zola

# Install dependencies
npm install

# Run the development server
npm run dev
```

### Windows

```bash
# Clone the repository
git clone https://github.com/ibelick/zola.git
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
<summary><strong>Supabase connection fails</strong></summary>

Symptoms: "Database connection failed" errors

**Solutions**:
1. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
2. Check Supabase project status at [Supabase Dashboard](https://app.supabase.com)
3. Ensure IP address is not blocked (check Supabase logs)
4. Verify database schema is set up correctly
5. For minimal testing, comment out Supabase env vars (works without auth)

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
5. Try running without Supabase first (minimal config)

</details>

<details>
<summary><strong>File uploads not working</strong></summary>

Symptoms: Upload button doesn't work or files don't save

**Solutions**:
1. Verify Supabase Storage buckets exist: `chat-attachments` and `avatars`
2. Check bucket policies allow uploads (see Storage Configuration section)
3. Ensure user is authenticated
4. Check file size limits (default: 10MB per file)
5. Verify `SUPABASE_SERVICE_ROLE` key has admin access

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
- [Supabase Docs](https://supabase.com/docs) - Database and auth
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
- [ ] Enable Supabase RLS policies
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

1. **Connection to Supabase fails**

   - Check your Supabase URL and API keys
   - Ensure your IP address is allowed in Supabase

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
