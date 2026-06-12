'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Play, Share2, RotateCcw, MessageCircleMore } from 'lucide-react';
import { apiUrl, readApiError } from '@/lib/api';
import { ServiceNotice, WorkingState } from '../components/service-notice';

export default function VoiceQuery() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Microphone access was blocked. Allow microphone permission and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const submitQuery = async () => {
    if (!audioBlob) return;

    setIsLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    try {
      const res = await fetch(apiUrl('/api/voice-query'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, 'HisabVani could not process this recording.'));
      }
      const data = await res.json();
      setTranscript(data.transcript);
      setResponse(data.response);
    } catch (err) {
      console.error('Error submitting query:', err);
      setError(err instanceof Error ? err.message : 'Error processing your query. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const shareToWhatsApp = () => {
    if (!response) return;
    const text = encodeURIComponent(response);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <main className="mx-auto min-h-[calc(100vh-70px)] max-w-5xl px-5 py-10 sm:px-8 lg:py-16">
      <div className="mb-8 grid gap-7 lg:grid-cols-[1fr_0.68fr] lg:items-end">
        <div>
          <p className="eyebrow">Voice query</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-bold leading-[0.94] tracking-[-0.05em] sm:text-6xl">
            Ask about money the way you speak at home.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/60">
            Hindi, Hinglish, Kannada, Tamil, or English. HisabVani transcribes your question and answers in the same conversational spirit.
          </p>
        </div>
        <ServiceNotice compact />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        {/* Recording Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="paper-card rounded-[2rem] p-7 sm:p-9"
        >
          <div className="mb-9 flex items-center justify-between">
            <div>
              <p className="eyebrow">Your turn</p>
              <h2 className="mt-2 text-3xl font-semibold">Record a question</h2>
            </div>
            <MessageCircleMore className="size-7 text-copper" />
          </div>
          
          <div className="flex flex-col items-center gap-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative grid size-32 place-items-center rounded-full transition-all ${
                isRecording 
                  ? 'bg-red-600 shadow-[0_0_0_14px_rgba(185,28,28,0.08)]'
                  : 'bg-ink text-saffron shadow-[0_20px_50px_rgba(25,20,15,0.2)] hover:bg-[#2c241c]'
              }`}
            >
              {isRecording ? (
                <Square className="w-12 h-12 text-white" />
              ) : (
                <Mic className="w-12 h-12 text-white" />
              )}
            </motion.button>

            <p className="max-w-xs text-center text-sm leading-6 text-muted">
              {isRecording ? 'Listening now. Tap again when your question is complete.' : 'Tap once, speak naturally, then stop and review your recording.'}
            </p>

            {audioBlob && !isRecording && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex gap-4"
              >
                <button
                  onClick={() => {
                    const url = URL.createObjectURL(audioBlob);
                    new Audio(url).play();
                  }}
                  className="flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-bold transition-colors hover:bg-ink/5"
                >
                  <Play className="w-5 h-5" />
                  Play
                </button>
                <button
                  onClick={submitQuery}
                  disabled={isLoading}
                  className="rounded-full bg-copper px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
                >
                  {isLoading ? <WorkingState label="Thinking" /> : 'Ask HisabVani'}
                </button>
                <button
                  onClick={() => {
                    setAudioBlob(null);
                    setTranscript('');
                    setResponse('');
                    setError('');
                  }}
                  className="grid size-11 place-items-center rounded-full border border-ink/12 text-muted hover:text-ink"
                  aria-label="Record again"
                >
                  <RotateCcw className="size-4" />
                </button>
              </motion.div>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-7 rounded-2xl border border-red-900/10 bg-red-50 p-4 text-sm font-semibold text-red-900">
              {error}
            </p>
          )}
        </motion.div>

        {/* Results */}
        <section className="min-h-[430px] rounded-[2rem] bg-ink p-6 text-cream shadow-[0_30px_80px_rgba(25,20,15,0.2)] sm:p-8">
          {!transcript && !response ? (
            <div className="flex h-full min-h-[360px] flex-col justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-saffron">HisabVani replies here</p>
              <div>
                <p className="font-display text-4xl font-bold leading-[1.02] text-white/92">
                  “Is month humne sabse zyada kahan kharch kiya?”
                </p>
                <p className="mt-5 max-w-lg text-sm leading-7 text-white/48">
                  Your transcript and answer stay together, making the result easy to verify and share.
                </p>
              </div>
            </div>
          ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {transcript && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-saffron">You said</h3>
                <p className="mt-3 text-lg leading-7 text-white/82">{transcript}</p>
              </div>
            )}

            {response && (
              <div className="rounded-2xl bg-cream p-6 text-ink">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-display font-semibold text-copper">HisabVani says</h3>
                  <button
                    onClick={shareToWhatsApp}
                    className="flex items-center gap-2 rounded-full bg-leaf px-4 py-2 text-xs font-bold text-white transition-transform active:scale-95"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                </div>
                <p className="text-lg leading-8">{response}</p>
              </div>
            )}
          </motion.div>
          )}
        </section>
      </div>
    </main>
  );
}
