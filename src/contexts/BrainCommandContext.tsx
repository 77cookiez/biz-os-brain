import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { useBrainChat } from '@/hooks/useBrainChat';

interface BrainCommandContextType {
  input: string;
  setInput: (val: string) => void;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  focusInput: () => void;
  prefillAndFocus: (text: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  messages: { role: 'user' | 'assistant'; content: string }[];
  isLoading: boolean;
  sendMessage: (input: string, action?: string) => Promise<void>;
  clearMessages: () => void;
  draftResponse: string | null;
  setDraftResponse: (val: string | null) => void;
  showDraft: boolean;
  setShowDraft: (val: boolean) => void;
  pendingMessage: string | null;
  setPendingMessage: (val: string | null) => void;
}

const BrainCommandContext = createContext<BrainCommandContextType | null>(null);

export function BrainCommandProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [draftResponse, setDraftResponse] = useState<string | null>(null);
  const [showDraft, setShowDraft] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null!);
  const { messages, isLoading, sendMessage, clearMessages } = useBrainChat();

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const prefillAndFocus = useCallback((text: string) => {
    setInput(text);
    focusInput();
  }, [focusInput]);

  return (
    <BrainCommandContext.Provider value={{
      input, setInput, isOpen, setIsOpen,
      focusInput, prefillAndFocus, inputRef,
      messages, isLoading, sendMessage, clearMessages,
      draftResponse, setDraftResponse, showDraft, setShowDraft,
      pendingMessage, setPendingMessage,
    }}>
      {children}
    </BrainCommandContext.Provider>
  );
}

export function useBrainCommand() {
  const ctx = useContext(BrainCommandContext);
  if (!ctx) {
    // Return safe defaults when provider hasn't mounted yet (e.g. during error recovery)
    return {
      input: '',
      setInput: () => {},
      isOpen: false,
      setIsOpen: () => {},
      focusInput: () => {},
      prefillAndFocus: () => {},
      inputRef: { current: null } as React.RefObject<HTMLInputElement>,
      messages: [] as { role: 'user' | 'assistant'; content: string }[],
      isLoading: false,
      sendMessage: async () => {},
      clearMessages: () => {},
      draftResponse: null as string | null,
      setDraftResponse: () => {},
      showDraft: false,
      setShowDraft: () => {},
      pendingMessage: null as string | null,
      setPendingMessage: () => {},
    } satisfies BrainCommandContextType;
  }
  return ctx;
}
