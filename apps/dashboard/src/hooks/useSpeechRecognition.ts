import { useEffect, useMemo, useRef, useState } from "react";

interface SpeechRecognitionResultLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  start(): void;
  stop(): void;
  addEventListener(type: "result", listener: (event: SpeechRecognitionResultLike) => void): void;
  addEventListener(type: "end" | "error", listener: () => void): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

/**
 * Browser-native voice input (Web Speech API) — no server-side speech
 * infrastructure. Supported in Chrome/Edge; `supported` is false elsewhere
 * (Firefox, Safari as of this writing) so callers can hide the mic button.
 */
export function useSpeechRecognition(onResult: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const supported = useMemo(
    () => typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  useEffect(() => {
    if (!supported) return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition!;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.addEventListener("result", (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    });
    recognition.addEventListener("end", () => setListening(false));
    recognition.addEventListener("error", () => setListening(false));
    recognitionRef.current = recognition;
  }, [supported, onResult]);

  function toggle() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      setListening(true);
      recognitionRef.current.start();
    }
  }

  return { supported, listening, toggle };
}
