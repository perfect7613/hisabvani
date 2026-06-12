'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, ArrowLeft, RotateCcw, BookOpen } from 'lucide-react';
import Link from 'next/link';

const CATEGORY_EMOJI: Record<string, string> = {
  food: '🍛',
  transport: '🛺',
  education: '📚',
  medical: '💊',
  entertainment: '🎬',
  shopping: '🛍️',
  utilities: '💡',
  rent: '🏠',
  other: '📝',
};

function AnimatedAmount({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 800;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [target]);

  return <>{display.toLocaleString('en-IN')}</>;
}

export default function VoiceExpense() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const submitExpense = async () => {
    if (!audioBlob) return;
    setIsLoading(true);

    const formData = new FormData();
    formData.append('audio', audioBlob, 'expense.wav');

    try {
      const res = await fetch('http://localhost:8000/api/voice-expense', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setTranscript(data.transcript);
      setAmount(data.amount);
      setCategory(data.category);
      setDescription(data.description);
      setConfirmation(data.confirmation);
    } catch (err) {
      console.error('Error:', err);
      setConfirmation('Error processing your expense. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setAudioBlob(null);
    setTranscript('');
    setAmount(null);
    setCategory('');
    setDescription('');
    setConfirmation('');
    setRecordingTime(0);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative corner marks */}
      <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-primary/20" />
      <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-primary/20" />
      <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-primary/20" />
      <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-primary/20" />

      {/* Header */}
      <header className="border-b border-border bg-white/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-5">
          <Link
            href="/"
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:text-primary hover:border-primary transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-display font-bold text-foreground leading-tight">
                Voice Khata
              </h1>
              <p className="text-xs text-muted tracking-wide uppercase">Quick Expense Journal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 pb-32">
        {/* Intro text */}
        {!audioBlob && !confirmation && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <p className="text-muted text-base leading-relaxed max-w-md mx-auto">
              Bol ke kharcha likho. Just speak naturally in Hindi, Hinglish, or English.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                '"Aaj chai pe 50 rupaye"',
                '"School fees 15000 di"',
                '"Petrol 500 ka"',
              ].map((example) => (
                <span
                  key={example}
                  className="text-xs px-3 py-1.5 rounded-full bg-accent/60 text-foreground/70 border border-border"
                >
                  {example}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recording Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="flex flex-col items-center"
        >
          {/* Mic Button */}
          <div className="relative mb-6">
            {/* Pulse rings when recording */}
            <AnimatePresence>
              {isRecording && (
                <>
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute inset-0 rounded-full border-2 border-red-400"
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 2,
                        delay: i * 0.5,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                    />
                  ))}
                </>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.92 }}
              onClick={isRecording ? stopRecording : startRecording}
              className={`
                relative w-28 h-28 rounded-full flex items-center justify-center
                transition-all duration-300 z-10
                ${
                  isRecording
                    ? 'bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]'
                    : audioBlob
                    ? 'bg-border shadow-none'
                    : 'bg-primary shadow-[0_0_40px_rgba(217,119,6,0.25)] breathe'
                }
              `}
            >
              {isRecording ? (
                <Square className="w-8 h-8 text-white" fill="white" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </motion.button>
          </div>

          {/* Status text */}
          <AnimatePresence mode="wait">
            {isRecording ? (
              <motion.div
                key="recording"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-red-500 font-medium text-sm tracking-wide uppercase mb-1">
                  Recording
                </p>
                <p className="text-2xl font-display font-bold text-foreground tabular-nums">
                  {formatTime(recordingTime)}
                </p>
              </motion.div>
            ) : audioBlob ? (
              <motion.div
                key="ready"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-3 mt-2"
              >
                <button
                  onClick={resetForm}
                  className="px-5 py-2.5 rounded-full border border-border text-sm text-muted hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Redo
                </button>
                <button
                  onClick={submitExpense}
                  disabled={isLoading}
                  className="px-7 py-2.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary-light transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Logging...
                    </span>
                  ) : (
                    'Log Expense'
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.p
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-muted text-sm"
              >
                Tap to record
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Ledger Entry */}
        <AnimatePresence>
          {confirmation && amount !== null && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mt-14"
            >
              {/* Stamp confirmation */}
              <div className="flex justify-center mb-8">
                <div className="stamp-in">
                  <div className="w-20 h-20 rounded-full border-[3px] border-secondary flex items-center justify-center rotate-[-6deg]">
                    <svg
                      viewBox="0 0 24 24"
                      className="w-10 h-10 text-secondary"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Ledger card */}
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                {/* Top decorative border */}
                <div className="h-1 bg-gradient-to-r from-primary via-primary-light to-primary" />

                <div className="p-8 ledger-line">
                  {/* Amount */}
                  <div className="text-center mb-8">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-xs text-muted uppercase tracking-[0.2em] mb-2"
                    >
                      Amount
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="text-5xl font-display font-bold text-foreground"
                    >
                      <span className="text-primary">₹</span>
                      <AnimatedAmount target={amount} />
                    </motion.p>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-border my-6" />

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-6">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <p className="text-xs text-muted uppercase tracking-[0.15em] mb-1.5">
                        Category
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{CATEGORY_EMOJI[category] || '📝'}</span>
                        <span className="text-foreground font-medium capitalize">{category}</span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.45 }}
                    >
                      <p className="text-xs text-muted uppercase tracking-[0.15em] mb-1.5">
                        Description
                      </p>
                      <p className="text-foreground font-medium">{description}</p>
                    </motion.div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-border my-6" />

                  {/* Transcript */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55 }}
                  >
                    <p className="text-xs text-muted uppercase tracking-[0.15em] mb-1.5">
                      You said
                    </p>
                    <p className="text-foreground/80 italic text-base leading-relaxed">
                      &ldquo;{transcript}&rdquo;
                    </p>
                  </motion.div>
                </div>

                {/* Confirmation footer */}
                <div className="bg-secondary/5 border-t border-border px-8 py-4">
                  <p className="text-secondary text-sm font-medium text-center">
                    {confirmation}
                  </p>
                </div>
              </div>

              {/* Log another */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex justify-center mt-8"
              >
                <button
                  onClick={resetForm}
                  className="px-8 py-3 rounded-full border-2 border-primary text-primary text-sm font-medium hover:bg-primary hover:text-white transition-all duration-300"
                >
                  Log Another Expense
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
