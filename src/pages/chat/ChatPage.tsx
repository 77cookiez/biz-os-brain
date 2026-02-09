import { useState, useEffect, useCallback } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { ThreadList } from '@/components/chat/ThreadList';
import { MessageView } from '@/components/chat/MessageView';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { NewThreadDialog } from '@/components/chat/NewThreadDialog';
import { useChatThreads } from '@/hooks/useChatThreads';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useReadReceipts, useChatAudit } from '@/hooks/useChatUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

const WELCOME_KEY = 'chat_welcome_seen';

function hasSeenWelcome(workspaceId: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem(WELCOME_KEY) || '{}');
    return !!seen[workspaceId];
  } catch { return false; }
}

function markWelcomeSeen(workspaceId: string) {
  try {
    const seen = JSON.parse(localStorage.getItem(WELCOME_KEY) || '{}');
    seen[workspaceId] = true;
    localStorage.setItem(WELCOME_KEY, JSON.stringify(seen));
  } catch {}
}

export default function ChatPage() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { threads, loading: threadsLoading, createThread, deleteThread, refreshThreads } = useChatThreads();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const { messages, loading: messagesLoading, sendMessage, deleteMessage } = useChatMessages(selectedThreadId);
  const { typingUsers, broadcastTyping } = useTypingIndicator(selectedThreadId);
  const { markAsRead } = useReadReceipts(selectedThreadId);
  const { logAction } = useChatAudit();
  const [showWelcome, setShowWelcome] = useState(false);

  // Determine if welcome should show
  useEffect(() => {
    if (currentWorkspace && !hasSeenWelcome(currentWorkspace.id)) {
      setShowWelcome(true);
    }
  }, [currentWorkspace?.id]);

  // Mark welcome as seen once user sends a message or has threads
  useEffect(() => {
    if (showWelcome && currentWorkspace && threads.length > 0) {
      markWelcomeSeen(currentWorkspace.id);
      // Keep showing until they navigate to a thread
    }
  }, [threads.length, showWelcome, currentWorkspace?.id]);

  // Mark as read when viewing thread
  useEffect(() => {
    if (selectedThreadId && messages.length > 0) {
      markAsRead();
    }
  }, [selectedThreadId, messages.length, markAsRead]);

  // Workspace admin check (owner or admin role)
  const isAdmin = true; // For now, allow message/thread owners + workspace owners. RLS enforces actual permission.

  const handleDeleteThread = useCallback(async (threadId: string) => {
    const ok = await deleteThread(threadId);
    if (ok) {
      logAction('chat_thread.deleted', threadId);
      toast.success('Thread deleted');
      if (selectedThreadId === threadId) setSelectedThreadId(null);
    } else {
      toast.error('Failed to delete thread');
    }
  }, [deleteThread, logAction, selectedThreadId]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    const ok = await deleteMessage(messageId);
    if (ok) {
      logAction('chat_message.deleted', messageId);
    } else {
      toast.error('Failed to delete message');
    }
  }, [deleteMessage, logAction]);

  const handleSend = useCallback(async (text: string) => {
    const ok = await sendMessage(text);
    if (ok) {
      if (showWelcome && currentWorkspace) {
        markWelcomeSeen(currentWorkspace.id);
        setShowWelcome(false);
      }
      // Refresh thread list to update last message preview
      refreshThreads();
    }
    return ok;
  }, [sendMessage, showWelcome, currentWorkspace?.id, refreshThreads]);

  return (
    <div className="flex h-full bg-background rounded-lg border border-border overflow-hidden">
      {/* Thread list */}
      <div className="w-72 shrink-0">
        <ThreadList
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={(id) => {
            setSelectedThreadId(id);
            if (showWelcome && currentWorkspace) {
              markWelcomeSeen(currentWorkspace.id);
              setShowWelcome(false);
            }
          }}
          onNewThread={() => setNewThreadOpen(true)}
          onDeleteThread={handleDeleteThread}
          loading={threadsLoading}
          isAdmin={isAdmin}
        />
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {selectedThreadId ? (
          <>
            <MessageView
              messages={messages}
              loading={messagesLoading}
              typingUsers={typingUsers}
              onDeleteMessage={handleDeleteMessage}
              isAdmin={isAdmin}
              showWelcome={showWelcome}
            />
            <MessageComposer onSend={handleSend} onTyping={broadcastTyping} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-5 px-6">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquarePlus className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center space-y-1.5 max-w-xs">
              <h3 className="text-base font-semibold text-foreground">TeamChat</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Select a conversation or start a new one.
              </p>
            </div>
          </div>
        )}
      </div>

      <NewThreadDialog
        open={newThreadOpen}
        onOpenChange={setNewThreadOpen}
        onCreated={(id) => {
          setNewThreadOpen(false);
          setSelectedThreadId(id);
          logAction('chat_thread.created', id);
        }}
        createThread={createThread}
      />
    </div>
  );
}
