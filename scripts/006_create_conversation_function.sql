-- Drop the problematic recursive policy
drop policy if exists "Users can add participants to conversations they created" on public.conversation_participants;

-- Create a function to create a conversation with two participants
-- This function uses SECURITY DEFINER to bypass RLS
create or replace function public.create_conversation_with_participants(
  participant1_id uuid,
  participant2_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_conversation_id uuid;
begin
  -- Create the conversation
  insert into public.conversations (created_by)
  values (participant1_id)
  returning id into new_conversation_id;

  -- Add both participants
  insert into public.conversation_participants (conversation_id, user_id)
  values 
    (new_conversation_id, participant1_id),
    (new_conversation_id, participant2_id);

  return new_conversation_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.create_conversation_with_participants(uuid, uuid) to authenticated;
