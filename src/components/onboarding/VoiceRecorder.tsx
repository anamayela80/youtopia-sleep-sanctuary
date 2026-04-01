import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Mic, Square, RotateCcw, Check } from "lucide-react";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  onCancel: () => void;
}

const VoiceRecorder = ({ onRecordingComplete, onCancel }: VoiceRecorderProps) => {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  const MIN_SECONDS = 30;
  const MAX_SECONDS = 120;

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const updateLevel = () => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    setAudioLevel(Math.sqrt(sum / data.length));
    animFrameRef.current = requestAnimationFrame(updateLevel);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = blob;
        setState("done");
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setState("recording");
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= MAX_SECONDS) {
            recorder.stop();
            if (timerRef.current) clearInterval(timerRef.current);
            return MAX_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);

      updateLevel();
    } catch {
      alert("Microphone access is required to clone your voice.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const resetRecording = () => {
    setState("idle");
    setElapsed(0);
    setAudioLevel(0);
    audioBlobRef.current = null;
  };

  const confirmRecording = () => {
    if (audioBlobRef.current) {
      onRecordingComplete(audioBlobRef.current);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const bars = 24;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center"
    >
      <h2 className="font-heading text-2xl text-secondary mb-2">Record your voice</h2>
      <p className="font-body text-sm text-muted-foreground mb-6 text-center">
        Read the passage below naturally. We need at least 30 seconds.
      </p>

      {/* Sample text to read */}
      <div className="w-full p-4 rounded-2xl bg-cream-light border border-border mb-6 max-h-32 overflow-y-auto">
        <p className="font-body text-sm text-accent leading-relaxed italic">
          "Tonight, I give myself permission to rest. I release the weight of the day 
          and allow my body to soften into peace. With every breath, I feel calmer, 
          lighter, and more at ease. I am safe, I am loved, and I trust that tomorrow 
          holds beautiful possibilities. The stars above remind me that even in darkness, 
          there is always light. Sleep carries me gently into a place of deep restoration."
        </p>
      </div>

      {/* Waveform visualization */}
      <div className="w-full h-16 flex items-center justify-center gap-[3px] mb-4">
        {Array.from({ length: bars }).map((_, i) => {
          const height =
            state === "recording"
              ? Math.max(4, audioLevel * 60 * (0.5 + Math.random() * 0.5))
              : state === "done"
              ? 8 + Math.sin(i * 0.5) * 6
              : 4;
          return (
            <motion.div
              key={i}
              className={`w-1.5 rounded-full ${
                state === "recording" ? "bg-primary" : state === "done" ? "bg-primary/50" : "bg-muted"
              }`}
              animate={{ height }}
              transition={{ duration: 0.1 }}
            />
          );
        })}
      </div>

      {/* Timer */}
      <div className="mb-6 text-center">
        <span className="font-body text-2xl font-semibold text-foreground">{formatTime(elapsed)}</span>
        <span className="font-body text-sm text-muted-foreground ml-2">/ {formatTime(MAX_SECONDS)}</span>
        {state === "recording" && elapsed < MIN_SECONDS && (
          <p className="font-body text-xs text-primary mt-1">
            Keep going — {MIN_SECONDS - elapsed}s more needed
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        {state === "idle" && (
          <>
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl font-body text-sm text-muted-foreground"
            >
              Cancel
            </button>
            <button
              onClick={startRecording}
              className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground active:scale-95 transition-all"
            >
              <Mic size={24} />
            </button>
          </>
        )}

        {state === "recording" && (
          <button
            onClick={stopRecording}
            disabled={elapsed < MIN_SECONDS}
            className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center text-white active:scale-95 transition-all disabled:opacity-40"
          >
            <Square size={20} />
          </button>
        )}

        {state === "done" && (
          <>
            <button
              onClick={resetRecording}
              className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground active:scale-95 transition-all"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={confirmRecording}
              className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground active:scale-95 transition-all"
            >
              <Check size={24} />
            </button>
          </>
        )}
      </div>

      <p className="font-body text-xs text-muted-foreground mt-6 text-center max-w-xs">
        🔒 Your recording is used only to create your meditation voice. It is permanently deleted immediately after.
      </p>
    </motion.div>
  );
};

export default VoiceRecorder;
