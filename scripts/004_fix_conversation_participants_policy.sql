-- Drop the old restrictive policy
drop policy if exists "Users can add themselves to conversations" on public.conversation_participants;

-- Create a new policy that allows users to add participants to conversations they are part of
create policy "Users can add participants to their conversations"
  on public.conversation_participants for insert
  with check (
    -- Allow if the user is already a participant in this conversation
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
      and cp.user_id = auth.uid()
    )
    -- OR if this is a new conversation (no participants yet)
    or not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
    )
  );
