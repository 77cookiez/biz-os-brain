
-- Enable realtime for chat_threads (chat_messages already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;
