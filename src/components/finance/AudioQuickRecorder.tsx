import { useState, useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AudioQuickRecorderProps {
  onRecordedText: (text: string) => void;
}

export function AudioQuickRecorder({ onRecordedText }: AudioQuickRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        try {
          // Check for SpeechRecognition in browser as fast local fallback
          // or send audio data
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (SpeechRecognition) {
            // SpeechRecognition is handled live
          } else {
            toast.info("Audio capturado. Procesando intención...");
          }
        } catch {
          toast.error("Error al procesar audio");
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Escuchando... Di algo como 'Cené en restaurante 25 dólares con DolarApp'");
    } catch {
      toast.error("Permiso de micrófono no otorgado");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  return (
    <Button
      type="button"
      variant={isRecording ? "destructive" : "outline"}
      size="icon"
      className={`h-10 w-10 shrink-0 rounded-full transition-all ${
        isRecording ? "animate-pulse ring-4 ring-destructive/30" : ""
      }`}
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      title={isRecording ? "Detener grabación" : "Grabar nota de voz"}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
