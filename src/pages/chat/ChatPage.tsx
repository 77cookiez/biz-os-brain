import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { ThreadList } from '@/components/chat/ThreadList';
import { MessageView } from '@/components/chat/MessageView';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { NewThreadDialog } from '@/components/chat/NewThreadDialog';
import { useChatThreads } from '@/hooks/useChatThreads';
import { useChatMessages } from '@/hooks/useChatMessages';

export default function ChatPage() {
  const { threads, loading: threadsLoading, createThread } = useChatThreads();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const { messages, loading: messagesLoading, sendMessage } = useChatMessages(selectedThreadId);

  return (
    <div className="flex h-full bg-background rounded-lg border border-border overflow-hidden">
      {/* Thread list */}
      <div className="w-72 shrink-0">
        <ThreadList
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
          onNewThread={() => setNewThreadOpen(true)}
          loading={threadsLoading}
        />
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedThreadId ? (
          <>
            <MessageView messages={messages} loading={messagesLoading} />
            <MessageComposer onSend={sendMessage} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquarePlus className="h-10 w-10" />
            <p className="text-sm">Select a conversation or start a new one</p>
          </div>
        )}
      </div>

      <NewThreadDialog
        open={newThreadOpen}
        onOpenChange={setNewThreadOpen}
        onCreated={(id) => {
          setNewThreadOpen(false);
          setSelectedThreadId(id);
        }}
        createThread={createThread}
      />
    </div>
  );
}
