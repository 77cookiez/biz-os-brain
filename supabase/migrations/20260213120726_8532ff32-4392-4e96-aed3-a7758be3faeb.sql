
-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat attachments
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Anyone can view chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete own chat attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create chat_attachments table
CREATE TABLE public.chat_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: workspace members who are thread members can view attachments
CREATE POLICY "Thread members can view attachments"
ON public.chat_attachments FOR SELECT
USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN chat_thread_members ctm ON ctm.thread_id = cm.thread_id AND ctm.user_id = auth.uid()
    WHERE cm.id = chat_attachments.message_id
  )
);

-- RLS: workspace members can insert attachments
CREATE POLICY "Workspace members can insert attachments"
ON public.chat_attachments FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND is_workspace_member(auth.uid(), workspace_id)
);

-- RLS: users can delete own attachments
CREATE POLICY "Users can delete own attachments"
ON public.chat_attachments FOR DELETE
USING (uploaded_by = auth.uid());

-- Indexes for performance
CREATE INDEX idx_chat_attachments_message_id ON public.chat_attachments(message_id);
CREATE INDEX idx_chat_attachments_workspace_id ON public.chat_attachments(workspace_id);

-- Index for message pagination performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created ON public.chat_messages(thread_id, created_at DESC);

-- Enable realtime for chat_attachments
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_attachments;
