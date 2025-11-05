-- Drop existing function if it exists
drop function if exists create_conversation_with_participants(uuid, uuid);

-- Create function to handle conversation creation with existing schema
create or replace function create_conversation_with_participants(
  user1_id text,
  user2_id text
)
returns text
language plpgsql
security definer
as $$
declare
  existing_conversation_id text;
  new_conversation_id text;
begin
  -- Check if conversation already exists between these two users
  select cp1."conversationId" into existing_conversation_id
  from "ConversationParticipant" cp1
  inner join "ConversationParticipant" cp2 
    on cp1."conversationId" = cp2."conversationId"
  where cp1."userId" = user1_id 
    and cp2."userId" = user2_id
  limit 1;

  -- If conversation exists, return it
  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  -- Create new conversation
  insert into "Conversation" ("id", "createdById", "createdAt")
  values (gen_random_uuid()::text, user1_id, now())
  returning id into new_conversation_id;

  -- Add both participants
  insert into "ConversationParticipant" ("id", "conversationId", "userId", "joinedAt")
  values 
    (gen_random_uuid()::text, new_conversation_id, user1_id, now()),
    (gen_random_uuid()::text, new_conversation_id, user2_id, now());

  return new_conversation_id;
end;
$$;
