import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Mic, Square, RotateCcw, Check, Shield } from "lucide-react";

interface VoiceCaptureStepProps {
  onRecordingComplete: (blob: Blob) => void;
  hasExistingClone: boolean;
}

const VoiceCaptureStep = ({ onRecordingComplete, hasExistingClone }: VoiceCaptureStepProps) => {
  const [state, setState] = useState<"intro" | "recording" | "active" | "done">(
    hasExistingClone ? "done" : "intro"
  );
  const [elapsed, setElapsed] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  const MIN_SECONDS = 60;
  const MAX_SECONDS = 90;

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => cleanup, [cleanup]);

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
      setState("active");
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
      alert("Microphone access is required to create your personal voice.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const resetRecording = () => {
    setState("recording");
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

  const bars = 32;

  if (hasExistingClone && state === "done" && !audioBlobRef.current) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center flex-1 justify-center"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Mic className="text-primary" size={32} />
        </div>
        <h2 className="font-heading text-2xl text-secondary mb-3">Voice already captured</h2>
        <p className="font-body text-sm text-muted-foreground mb-6 max-w-xs">
          Your voice clone is ready. Your seeds will be whispered in your own voice.
        </p>
        <button
          onClick={() => setState("intro")}
          className="font-body text-sm text-primary underline"
        >
          Re-record my voice
        </button>
      </motion.div>
    );
  }

  if (state === "intro") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex flex-col items-center text-center flex-1 justify-center"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Mic className="text-primary" size={32} />
        </div>

        <h2 className="font-heading text-2xl text-secondary mb-3 leading-snug">
          Your seeds will be spoken<br />in your own voice
        </h2>

        <p className="font-body text-accent mb-2 max-w-sm leading-relaxed">
          We need just 60 seconds of you speaking naturally to create it.
        </p>

        <p className="font-body text-sm text-muted-foreground mb-8 max-w-xs">
          You only do this once. From here, your voice is yours inside Youtopia.
        </p>

        {/* Privacy notice */}
        <div className="w-full p-4 rounded-2xl bg-teal-light/20 border border-primary/20 mb-6">
          <div className="flex items-start gap-3">
            <Shield size={18} className="text-primary mt-0.5 flex-shrink-0" />
            <p className="font-body text-xs text-accent leading-relaxed text-left">
              Your voice is cloned once and stored privately in your account.
              It is used only to generate your personal seeds.
              You can delete your voice clone at any time from your settings.
            </p>
          </div>
        </div>

        <button
          onClick={() => setState("recording")}
          className="px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Start Recording
        </button>
      </motion.div>
    );
  }

  if (state === "recording") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center flex-1 justify-center"
      >
        <h2 className="font-heading text-xl text-secondary mb-2">Read this aloud</h2>
        <p className="font-body text-sm text-muted-foreground mb-6">
          Speak naturally, as if talking to a close friend.
        </p>

        <div className="w-full p-5 rounded-2xl bg-cream-light border border-border mb-8">
          <p className="font-body text-accent leading-relaxed italic">
            "Tell us something you're looking forward to this month. 
            Speak naturally, as if you're talking to a close friend.
            Share what excites you, what brings you peace, 
            or what you're hoping to create in the days ahead."
          </p>
        </div>

        <button
          onClick={startRecording}
          className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground active:scale-95 transition-all"
        >
          <Mic size={28} />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center flex-1 justify-center"
    >
      {/* Waveform */}
      <div className="w-full h-20 flex items-center justify-center gap-[2px] mb-6">
        {Array.from({ length: bars }).map((_, i) => {
          const height =
            state === "active"
              ? Math.max(4, audioLevel * 70 * (0.4 + Math.random() * 0.6))
              : 8 + Math.sin(i * 0.5) * 6;
          return (
            <motion.div
              key={i}
              className={`w-1.5 rounded-full ${state === "active" ? "bg-primary" : "bg-primary/50"}`}
              animate={{ height }}
              transition={{ duration: 0.1 }}
            />
          );
        })}
      </div>

      {/* Timer */}
      <div className="mb-8 text-center">
        <span className="font-body text-3xl font-semibold text-foreground">{formatTime(elapsed)}</span>
        <span className="font-body text-sm text-muted-foreground ml-2">/ {formatTime(MAX_SECONDS)}</span>
        {state === "active" && elapsed < MIN_SECONDS && (
          <p className="font-body text-xs text-primary mt-2">
            Keep going — {MIN_SECONDS - elapsed}s more needed
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-8">
        {state === "active" && (
          <button
            onClick={stopRecording}
            disabled={elapsed < MIN_SECONDS}
            className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground active:scale-95 transition-all disabled:opacity-40"
          >
            <Square size={24} />
          </button>
        )}

        {state === "done" && (
          <>
            <button
              onClick={resetRecording}
              className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground active:scale-95 transition-all"
            >
              <RotateCcw size={20} />
            </button>
            <button
              onClick={confirmRecording}
              className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground active:scale-95 transition-all"
            >
              <Check size={28} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default VoiceCaptureStep;
