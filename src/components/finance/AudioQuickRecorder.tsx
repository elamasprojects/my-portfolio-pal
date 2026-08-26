import { useState, useRef, useEffect } from "react";
import { Mic, Square, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AudioQuickRecorderProps {
  onRecordedText: (text: string) => void;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechRecognitionCtor | null;
}

/**
 * Dictation into the omnibar's text field.
 *
 * This used to open a `MediaRecorder`, collect the audio chunks, and then drop them: `onstop`
 * ran a branch commented "SpeechRecognition is handled live" without ever constructing one, so
 * `onRecordedText` was never called and the button recorded into nothing. It now uses the Web
 * Speech API directly, and when the browser has no such API the button says so instead of
 * miming a recording.
 */
export function AudioQuickRecorder({ onRecordedText }: AudioQuickRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = getSpeechRecognition() !== null;

  // Stop the microphone if this unmounts mid-dictation.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const startRecording = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    try {
      const recognition = new Recognition();
      recognition.lang = "es-AR";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = Array.from({ length: event.results.length }, (_, i) =>
          event.results[i][0].transcript
        )
          .join(" ")
          .trim();
        if (transcript) onRecordedText(transcript);
      };

      recognition.onerror = (event) => {
        setIsRecording(false);
        recognitionRef.current = null;
        toast.error(
          event?.error === "not-allowed"
            ? "Permiso de micrófono no otorgado"
            : "No se pudo transcribir el audio"
        );
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      toast.info("Escuchando... Ej: 'Cené en un restaurante 25 dólares con DolarApp'");
    } catch {
      setIsRecording(false);
      recognitionRef.current = null;
      toast.error("No se pudo iniciar el dictado");
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const label = !supported
    ? "El dictado no está disponible en este navegador"
    : isRecording
      ? "Detener el dictado"
      : "Dictar el movimiento";

  return (
    <Button
      type="button"
      variant={isRecording ? "destructive" : "outline"}
      size="icon"
      disabled={!supported}
      aria-label={label}
      title={label}
      onClick={isRecording ? stopRecording : startRecording}
      className={`h-10 w-10 shrink-0 rounded-full transition-all ${
        isRecording ? "animate-pulse" : ""
      }`}
    >
      {!supported ? (
        <MicOff className="h-4 w-4" />
      ) : isRecording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
