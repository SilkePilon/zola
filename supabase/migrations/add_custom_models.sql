-- Custom models table
create table if not exists public.custom_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  model_id text not null,
  provider_id text not null,
  base_url text,
  context_window integer,
  input_cost decimal(10, 6),
  output_cost decimal(10, 6),
  vision boolean default false,
  tools boolean default false,
  reasoning boolean default false,
  audio boolean default false,
  video boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_custom_models_user_id on public.custom_models(user_id);
create unique index if not exists idx_custom_models_user_model on public.custom_models(user_id, model_id);
