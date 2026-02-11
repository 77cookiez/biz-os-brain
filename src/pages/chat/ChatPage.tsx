import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus, ArrowLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThreadList } from '@/components/chat/ThreadList';
import { MessageView } from '@/components/chat/MessageView';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { NewThreadDialog } from '@/components/chat/NewThreadDialog';
import { ChatThreadHeader } from '@/components/chat/ChatThreadHeader';
import { useChatThreads } from '@/hooks/useChatThreads';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useReadReceipts, useChatAudit } from '@/hooks/useChatUtils';
import { useChatToWork } from '@/hooks/useChatToWork';
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { threads, loading: threadsLoading, createThread, deleteThread, refreshThreads } = useChatThreads();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const { messages, loading: messagesLoading, sendMessage, deleteMessage } = useChatMessages(selectedThreadId);
  const { typingUsers, broadcastTyping } = useTypingIndicator(selectedThreadId);
  const { markAsRead } = useReadReceipts(selectedThreadId);
  const { logAction } = useChatAudit();
  const { createTaskFromMessage, createGoalFromThread } = useChatToWork();
  const [showWelcome, setShowWelcome] = useState(false);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const isMobile = useIsMobile();

  // On mobile, show thread list when no thread selected
  const showingMessages = isMobile && selectedThreadId !== null;

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
    }
  }, [threads.length, showWelcome, currentWorkspace?.id]);

  // Mark as read when viewing thread
  useEffect(() => {
    if (selectedThreadId && messages.length > 0) {
      markAsRead();
    }
  }, [selectedThreadId, messages.length, markAsRead]);

  const isAdmin = true;

  const selectedThread = threads.find(t => t.id === selectedThreadId);
  const threadTitle = selectedThread?.title || (selectedThread?.type === 'direct' ? 'Direct Message' : 'Group Chat');

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
      refreshThreads();
    }
    return ok;
  }, [sendMessage, showWelcome, currentWorkspace?.id, refreshThreads]);

  const handleCreateGoal = useCallback(async () => {
    if (!selectedThreadId) return;
    setCreatingGoal(true);
    await createGoalFromThread(selectedThreadId);
    setCreatingGoal(false);
  }, [selectedThreadId, createGoalFromThread]);

  return (
    <div className="flex h-full bg-background rounded-lg border border-border overflow-hidden">
      {/* Thread list — hidden on mobile when viewing messages */}
      <div className={cn(
        "shrink-0 border-r border-border",
        isMobile ? (showingMessages ? "hidden" : "w-full") : "w-72"
      )}>
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
      <div className={cn(
        "flex-1 flex flex-col min-w-0 bg-background",
        isMobile && !showingMessages ? "hidden" : ""
      )}>
        {selectedThreadId ? (
          <>
            <div className="flex items-center">
              {isMobile && (
                <Button variant="ghost" size="icon" className="shrink-0 ml-1" onClick={() => setSelectedThreadId(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <ChatThreadHeader
                threadTitle={threadTitle}
                onCreateGoal={handleCreateGoal}
                creatingGoal={creatingGoal}
              />
            </div>
            <MessageView
              messages={messages}
              loading={messagesLoading}
              typingUsers={typingUsers}
              onDeleteMessage={handleDeleteMessage}
              onCreateTaskFromMessage={createTaskFromMessage}
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
              <h3 className="text-base font-semibold text-foreground">{t('chat.title')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('chat.selectThread')}
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
