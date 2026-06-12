'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Play, Share2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function VoiceQuery() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
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
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    try {
      const res = await fetch('http://localhost:8000/api/voice-query', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setTranscript(data.transcript);
      setResponse(data.response);
    } catch (err) {
      console.error('Error submitting query:', err);
      setResponse('Error processing your query. Please try again.');
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6">
          <Link href="/" className="text-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-3xl font-display font-bold text-primary">Voice Query</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Recording Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-border p-8 mb-8"
        >
          <h2 className="text-2xl font-display font-semibold mb-6">Ask Your Question</h2>
          
          <div className="flex flex-col items-center gap-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'bg-primary hover:bg-primary-light'
              }`}
            >
              {isRecording ? (
                <Square className="w-12 h-12 text-white" />
              ) : (
                <Mic className="w-12 h-12 text-white" />
              )}
            </motion.button>

            <p className="text-muted text-center">
              {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
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
                  className="px-6 py-3 bg-border rounded-lg hover:bg-muted/20 transition-colors flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Play
                </button>
                <button
                  onClick={submitQuery}
                  disabled={isLoading}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Submit Query'}
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Results */}
        {(transcript || response) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {transcript && (
              <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
                <h3 className="text-lg font-display font-semibold mb-3 text-muted">You said:</h3>
                <p className="text-foreground text-lg">{transcript}</p>
              </div>
            )}

            {response && (
              <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-display font-semibold text-primary">HisabVani says:</h3>
                  <button
                    onClick={shareToWhatsApp}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                </div>
                <p className="text-foreground text-lg leading-relaxed">{response}</p>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
