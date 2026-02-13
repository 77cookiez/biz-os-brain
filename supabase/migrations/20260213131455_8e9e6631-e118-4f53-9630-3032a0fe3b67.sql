
-- Create chat_reactions table
CREATE TABLE public.chat_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

-- Thread members can view reactions
CREATE POLICY "Thread members can view reactions"
ON public.chat_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN chat_thread_members ctm ON ctm.thread_id = cm.thread_id AND ctm.user_id = auth.uid()
    WHERE cm.id = chat_reactions.message_id
  )
);

-- Users can add reactions to messages in threads they belong to
CREATE POLICY "Thread members can add reactions"
ON public.chat_reactions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN chat_thread_members ctm ON ctm.thread_id = cm.thread_id AND ctm.user_id = auth.uid()
    WHERE cm.id = chat_reactions.message_id
  )
);

-- Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
ON public.chat_reactions
FOR DELETE
USING (user_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_chat_reactions_message_id ON public.chat_reactions(message_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;
