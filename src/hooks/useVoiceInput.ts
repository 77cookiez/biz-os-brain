import { useState, useCallback, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface UseVoiceInputOptions {
  onResult?: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
  continuous?: boolean;
}

interface UseVoiceInputReturn {
  isListening: boolean;
  isSupported: boolean;
  confidence: 'high' | 'medium' | 'low';
  startListening: () => void;
  stopListening: () => void;
}

const LANG_MAP: Record<string, string> = {
  en: 'en-US',
  ar: 'ar-SA',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
};

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { onResult, onInterimResult, continuous = true } = options;
  const { currentLanguage } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('high');
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognition;

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;

    // Stop any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }

    isListeningRef.current = true;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Use ULL-mapped locale, fallback to browser default
    const locale = LANG_MAP[currentLanguage.code] || currentLanguage.code;
    recognition.lang = locale;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let minConfidence = 1;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const conf = result[0].confidence;

        if (conf < minConfidence) minConfidence = conf;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Map confidence score
      if (minConfidence > 0.85) setConfidence('high');
      else if (minConfidence > 0.6) setConfidence('medium');
      else setConfidence('low');

      if (interimTranscript && onInterimResult) {
        onInterimResult(interimTranscript);
      }

      if (finalTranscript && onResult) {
        onResult(finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('[Voice] Recognition error:', event.error);
      // Only fully stop on fatal errors (not silence/aborted)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        isListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;
      }
      // 'no-speech', 'aborted', 'network' → let onend handle auto-restart
    };

    recognition.onend = () => {
      // Auto-restart if user hasn't explicitly stopped
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch (_) {
          // If restart fails, try creating a new instance after a brief delay
          setTimeout(() => {
            if (isListeningRef.current) {
              startListening();
            }
          }, 300);
        }
        return;
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }, [SpeechRecognition, currentLanguage.code, continuous, onResult, onInterimResult]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    confidence,
    startListening,
    stopListening,
  };
}
