-- Drop the problematic policy that causes infinite recursion
drop policy if exists "Users can add participants to their conversations" on public.conversation_participants;
drop policy if exists "Users can add themselves to conversations" on public.conversation_participants;

-- Add created_by column to conversations table if it doesn't exist
alter table public.conversations 
add column if not exists created_by uuid references auth.users(id) on delete cascade;

-- Update existing conversations to set created_by (optional, for existing data)
-- This sets created_by to the first participant of each conversation
update public.conversations c
set created_by = (
  select user_id 
  from public.conversation_participants cp 
  where cp.conversation_id = c.id 
  limit 1
)
where created_by is null;

-- Create a simple policy that allows users to add participants to conversations they created
create policy "Users can add participants to conversations they created"
  on public.conversation_participants for insert
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = conversation_participants.conversation_id
      and conversations.created_by = auth.uid()
    )
  );

-- Also allow users to add themselves to any conversation (for invites, etc.)
create policy "Users can add themselves to conversations"
  on public.conversation_participants for insert
  with check (auth.uid() = user_id);
