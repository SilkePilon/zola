-- Supabase public schema setup for Zola
-- Safe to run multiple times; uses IF NOT EXISTS where possible.

-- Extensions
create extension if not exists "pgcrypto";

-- Helper ENUM for message roles
do $$ begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'message_role' and n.nspname = 'public'
  ) then
    create type public.message_role as enum ('system','user','assistant','data');
  end if;
end $$;

-- Users (app-level profile mapped to auth.users)
create table if not exists public.users (
  id uuid primary key,
  email text not null,
  anonymous boolean default false,
  premium boolean default false,
  display_name text,
  profile_image text,
  favorite_models text[] default '{}',
  message_count integer default 0,
  daily_message_count integer default 0,
  daily_reset timestamptz,
  daily_pro_message_count integer default 0,
  daily_pro_reset timestamptz,
  system_prompt text,
  last_active_at timestamptz,
  created_at timestamptz default now()
);

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists idx_projects_user_id on public.projects(user_id);

-- Chats
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  model text,
  title text,
  public boolean default false,
  pinned boolean default false,
  pinned_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_chats_user_id on public.chats(user_id);
create index if not exists idx_chats_project_id on public.chats(project_id);
create index if not exists idx_chats_created_at on public.chats(created_at);

-- Messages
create table if not exists public.messages (
  id bigserial primary key,
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  role public.message_role not null,
  content text,
  parts jsonb,
  model text,
  message_group_id text,
  experimental_attachments jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_messages_chat_id on public.messages(chat_id);
create index if not exists idx_messages_user_id on public.messages(user_id);
create index if not exists idx_messages_created_at on public.messages(created_at);

-- Chat attachments
create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  file_url text not null,
  file_type text,
  file_size integer,
  file_name text,
  created_at timestamptz default now()
);
create index if not exists idx_chat_attachments_chat_id on public.chat_attachments(chat_id);
create index if not exists idx_chat_attachments_user_id on public.chat_attachments(user_id);

-- Feedback
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);
create index if not exists idx_feedback_user_id on public.feedback(user_id);

-- User API keys per provider
create table if not exists public.user_keys (
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  encrypted_key text not null,
  iv text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, provider)
);
create index if not exists idx_user_keys_user_id on public.user_keys(user_id);

-- User preferences (one-to-one)
create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  layout text,
  prompt_suggestions boolean,
  show_tool_invocations boolean,
  show_conversation_previews boolean,
  storage_bucket TEXT,
  multi_model_enabled boolean,
  hidden_models text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MCP (Model Context Protocol) servers configuration
create table if not exists public.mcp_servers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  enabled boolean default true,
  transport_type text not null check (transport_type in ('stdio', 'http', 'sse')),
  
  -- STDIO specific fields
  command text,
  args jsonb,
  env jsonb,
  
  -- HTTP/SSE specific fields
  url text,
  headers jsonb,
  
  -- UI
  icon text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_mcp_servers_user_id on public.mcp_servers(user_id);
create index if not exists idx_mcp_servers_enabled on public.mcp_servers(enabled) where enabled = true;

-- Optional: updated_at trigger for tables that track updates
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create or replace function public.set_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_chats_updated_at'
  ) then
    create trigger trg_chats_updated_at
    before update on public.chats
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_user_keys_updated_at'
  ) then
    create trigger trg_user_keys_updated_at
    before update on public.user_keys
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_mcp_servers_updated_at'
  ) then
    create trigger trg_mcp_servers_updated_at
    before update on public.mcp_servers
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Storage bucket setup for file uploads
-- Create storage bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Storage bucket policies
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow authenticated users to upload files'
  ) then
    create policy "Allow authenticated users to upload files"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'chat-attachments' and
      (storage.foldername(name))[1] = 'uploads'
    );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow public access to view files'
  ) then
    create policy "Allow public access to view files"
    on storage.objects
    for select
    to public
    using (bucket_id = 'chat-attachments');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow users to delete own files'
  ) then
    create policy "Allow users to delete own files"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'chat-attachments' and
      auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow users to update own files'
  ) then
    create policy "Allow users to update own files"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'chat-attachments' and
      auth.uid()::text = (storage.foldername(name))[1]
    )
    with check (
      bucket_id = 'chat-attachments' and
      auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;
end $$;

-- Recommended RLS (enable and basic owner policies). Uncomment to enable.
-- alter table public.users enable row level security;
-- alter table public.projects enable row level security;
-- alter table public.chats enable row level security;
-- alter table public.messages enable row level security;
-- alter table public.chat_attachments enable row level security;
-- alter table public.feedback enable row level security;
-- alter table public.user_keys enable row level security;
-- alter table public.user_preferences enable row level security;
-- alter table public.mcp_servers enable row level security;

-- Example simple policies (adjust to your needs):
-- create policy "Users can view own rows" on public.users for select using (auth.uid() = id);
-- create policy "Users can update own rows" on public.users for update using (auth.uid() = id);
-- create policy "Users can insert self" on public.users for insert with check (auth.uid() = id);

-- create policy "Project owner access" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "Chat owner access" on public.chats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "Message access by chat ownership" on public.messages for all using (
--   exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid())
-- ) with check (
--   exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid())
-- );
-- create policy "Attachment access by chat ownership" on public.chat_attachments for all using (
--   exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid())
-- ) with check (
--   exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid())
-- );
-- create policy "Feedback owner access" on public.feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "User keys owner access" on public.user_keys for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "User preferences owner access" on public.user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "MCP servers owner access" on public.mcp_servers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
