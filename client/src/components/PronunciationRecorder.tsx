import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, RotateCcw, CheckCircle2, XCircle, Play, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface WordScore {
  korean: string;
  correct: boolean;
  note: string;
}

interface PronunciationResult {
  score: number;
  transcribed: string;
  feedback: string;
  wordScores: WordScore[];
}

interface PronunciationRecorderProps {
  sentence: string;
}

type RecorderState = "idle" | "recording" | "processing" | "result";

export default function PronunciationRecorder({ sentence }: PronunciationRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    setError(null);
    setResult(null);
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        await scoreRecording(blob);
      };

      mediaRecorder.start();
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access was denied. Please allow microphone access and try again.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setState("processing");
  };

  const scoreRecording = async (blob: Blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const res = await fetch("/api/pronunciation-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, sentence }),
      });

      if (!res.ok) throw new Error("Scoring failed");
      const data: PronunciationResult = await res.json();
      setResult(data);
      setState("result");
    } catch {
      setError("Something went wrong while scoring your pronunciation. Please try again.");
      setState("idle");
    }
  };

  const playRecording = () => {
    if (!recordingUrl) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }
    const audio = new Audio(recordingUrl);
    audioRef.current = audio;
    audio.play();
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
  };

  const reset = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState("idle");
    setResult(null);
    setError(null);
    setSeconds(0);
    setIsPlaying(false);
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 55) return "text-yellow-600";
    return "text-red-500";
  };

  const scoreBg = (score: number) => {
    if (score >= 80) return "bg-green-50 border-green-200";
    if (score >= 55) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Practice Speaking
        </p>
        {state === "result" && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-muted-foreground hover:bg-secondary/50 gap-1"
            onClick={reset}
            data-testid="button-pronunciation-retry"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {state === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {error && (
              <p className="text-sm text-red-500 mb-3 p-3 bg-red-50 rounded-xl border border-red-200">
                {error}
              </p>
            )}
            <Button
              onClick={startRecording}
              className="w-full rounded-2xl py-6 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 gap-2 font-semibold"
              variant="ghost"
              data-testid="button-start-recording"
            >
              <Mic className="w-5 h-5" />
              Record yourself reading this sentence
            </Button>
          </motion.div>
        )}

        {state === "recording" && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative flex items-center justify-center">
              <motion.div
                className="absolute w-16 h-16 rounded-full bg-red-400/30"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
              <Button
                onClick={stopRecording}
                className="relative w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg"
                data-testid="button-stop-recording"
              >
                <MicOff className="w-6 h-6" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground font-mono" data-testid="text-recording-timer">
              Recording... {formatTime(seconds)}
            </p>
            <p className="text-xs text-muted-foreground">Tap the button to stop</p>
          </motion.div>
        )}

        {state === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col items-center gap-3 py-4"
          >
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Scoring your pronunciation...</p>
          </motion.div>
        )}

        {state === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className={`p-5 rounded-2xl border flex items-center gap-5 ${scoreBg(result.score)}`} data-testid="pronunciation-score-card">
              <div className="text-center shrink-0">
                <p className={`text-5xl font-bold ${scoreColor(result.score)}`} data-testid="text-pronunciation-score">
                  {result.score}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">out of 100</p>
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">You said:</p>
                <p className="text-sm text-muted-foreground italic" data-testid="text-transcribed">&ldquo;{result.transcribed}&rdquo;</p>
                <p className="text-sm text-foreground/80 leading-relaxed mt-2" data-testid="text-pronunciation-feedback">{result.feedback}</p>
              </div>
            </div>

            {recordingUrl && (
              <Button
                onClick={playRecording}
                variant="outline"
                className="w-full rounded-2xl py-5 gap-2 border-primary/20 text-primary hover:bg-primary/5"
                data-testid="button-play-recording"
              >
                {isPlaying ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    Stop Playback
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Listen to my recording
                  </>
                )}
              </Button>
            )}

            {result.wordScores && result.wordScores.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Word by Word</p>
                <div className="flex flex-wrap gap-2">
                  {result.wordScores.map((ws, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm ${
                        ws.correct
                          ? "bg-green-50 border-green-200 text-green-800"
                          : "bg-red-50 border-red-200 text-red-800"
                      }`}
                      title={ws.note}
                      data-testid={`word-score-${idx}`}
                    >
                      {ws.correct ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                      )}
                      <span className="font-medium">{ws.korean}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 mt-2">
                  {result.wordScores.filter((ws) => !ws.correct && ws.note).map((ws, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground/70">{ws.korean}:</span> {ws.note}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
