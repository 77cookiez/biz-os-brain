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

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognition;

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;

    // Stop any existing instance
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

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
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        stopListening();
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }, [SpeechRecognition, currentLanguage.code, continuous, onResult, onInterimResult, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
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
