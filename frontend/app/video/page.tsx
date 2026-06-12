'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Video, Download, ArrowLeft, Share2, Film } from 'lucide-react';
import Link from 'next/link';

export default function VideoReports() {
  const [transactionId, setTransactionId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const generateVideo = async () => {
    setIsLoading(true);
    setError('');
    setVideoUrl('');

    try {
      const payload = transactionId
        ? { transaction_id: parseInt(transactionId) }
        : {
            title: title || 'Expense Report',
            amount: parseFloat(amount) || 0,
            category: category || 'other',
            description: description || ''
          };

      const res = await fetch('http://localhost:8000/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to generate video');
      }

      const data = await res.json();
      const blob = base64ToBlob(data.video_base64, 'video/mp4');
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `expense_${transactionId || 'report'}.mp4`;
    a.click();
  };

  const shareVideo = () => {
    if (!videoUrl) return;
    const text = encodeURIComponent(`Check out my expense report: ${title} - ₹${amount}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6">
          <Link href="/" className="text-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-3xl font-display font-bold text-primary">Video Reports</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-border p-8 mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <Film className="w-8 h-8 text-primary" />
            <div>
              <h2 className="text-2xl font-display font-semibold">Generate Expense Video</h2>
              <p className="text-muted text-sm">Create a shareable video from your expense data</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b border-border pb-4 mb-4">
              <label className="block text-sm font-medium text-muted mb-2">
                Option 1: From Transaction ID
              </label>
              <input
                type="number"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Enter transaction ID"
                className="w-full px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="text-center text-muted text-sm my-4">— OR —</div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-muted mb-2">
                Option 2: Manual Entry
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="w-full px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Category</option>
                <option value="food">Food</option>
                <option value="transport">Transport</option>
                <option value="education">Education</option>
                <option value="medical">Medical</option>
                <option value="entertainment">Entertainment</option>
                <option value="shopping">Shopping</option>
                <option value="utilities">Utilities</option>
                <option value="rent">Rent</option>
                <option value="other">Other</option>
              </select>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              onClick={generateVideo}
              disabled={isLoading || (!transactionId && !amount)}
              className="w-full px-6 py-4 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating Video...
                </>
              ) : (
                <>
                  <Video className="w-5 h-5" />
                  Generate Video
                </>
              )}
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800"
            >
              {error}
            </motion.div>
          )}
        </motion.div>

        {videoUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-border p-8"
          >
            <h3 className="text-xl font-display font-semibold mb-4">Your Video</h3>
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg mb-6"
              style={{ maxHeight: '500px' }}
            />
            <div className="flex gap-4">
              <button
                onClick={downloadVideo}
                className="flex-1 px-6 py-3 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download
              </button>
              <button
                onClick={shareVideo}
                className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
