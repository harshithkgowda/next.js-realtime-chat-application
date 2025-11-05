-- Create conversations table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.conversations enable row level security;

-- Create conversation_participants table (many-to-many relationship)
create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamp with time zone default now(),
  unique(conversation_id, user_id)
);

-- Enable RLS
alter table public.conversation_participants enable row level security;

-- RLS Policies for conversations
create policy "Users can view conversations they are part of"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_participants.conversation_id = conversations.id
      and conversation_participants.user_id = auth.uid()
    )
  );

create policy "Users can create conversations"
  on public.conversations for insert
  with check (true);

-- RLS Policies for conversation_participants
create policy "Users can view participants of their conversations"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
      and cp.user_id = auth.uid()
    )
  );

create policy "Users can add themselves to conversations"
  on public.conversation_participants for insert
  with check (auth.uid() = user_id);

create policy "Users can remove themselves from conversations"
  on public.conversation_participants for delete
  using (auth.uid() = user_id);
