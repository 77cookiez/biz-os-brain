import { createContext, useContext, useState, useCallback, useRef } from 'react';
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
}

const BrainCommandContext = createContext<BrainCommandContextType | null>(null);

export function BrainCommandProvider({ children }: { children: React.ReactNode }) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [draftResponse, setDraftResponse] = useState<string | null>(null);
  const [showDraft, setShowDraft] = useState(false);
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
    }}>
      {children}
    </BrainCommandContext.Provider>
  );
}

export function useBrainCommand() {
  const ctx = useContext(BrainCommandContext);
  if (!ctx) throw new Error('useBrainCommand must be used within BrainCommandProvider');
  return ctx;
}
