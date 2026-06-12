'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle, ReceiptText, X } from 'lucide-react';
import { apiUrl, readApiError } from '@/lib/api';
import {
  addLedgerTransaction,
  createLocalRecordId,
} from '@/lib/household-ledger';
import { ServiceNotice, WorkingState } from '../components/service-notice';

type UploadResult = {
  record_id?: string;
  transaction: {
    date: string;
    amount: number;
    category: string;
    vendor: string;
    description: string;
  };
  extracted_text?: string;
};

export default function BillUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const uploadFile = async () => {
    if (!file) return;

    setIsUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(apiUrl('/api/upload-bill'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, 'The bill could not be read.'));
      }
      const data = await res.json();
      setResult(data);
      addLedgerTransaction({
        id: data.record_id || createLocalRecordId('bill'),
        date: data.transaction.date,
        amount: Number(data.transaction.amount),
        category: data.transaction.category,
        vendor: data.transaction.vendor,
        description: data.transaction.description,
        source: 'bill',
        extractedText: data.extracted_text,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err instanceof Error ? err.message : 'The bill could not be read.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="mx-auto min-h-[calc(100vh-70px)] max-w-6xl px-5 py-10 sm:px-8 lg:py-16">
      <div className="mb-9 grid gap-7 lg:grid-cols-[1fr_0.6fr] lg:items-end">
        <div>
          <p className="eyebrow">Bill scanner</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-bold leading-[0.94] tracking-[-0.05em] sm:text-6xl">
            Turn a folded receipt into a clean expense entry.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/60">
            Upload a photo or PDF. Sarvam Vision extracts the text, then HisabVani identifies the useful transaction details.
          </p>
        </div>
        <ServiceNotice compact />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="paper-card rounded-[2rem] p-6 sm:p-8"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="eyebrow">Add document</p>
              <h2 className="mt-2 text-3xl font-semibold">Choose a receipt</h2>
            </div>
            <ReceiptText className="size-7 text-copper" />
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-[1.6rem] border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-copper bg-saffron/15'
                : 'border-ink/15 bg-white/35 hover:border-copper hover:bg-white/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept="image/*,.pdf"
              className="hidden"
            />
            <span className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-ink text-saffron">
              <Upload className="size-7" />
            </span>
            {isDragActive ? (
              <p className="text-lg text-primary font-medium">Drop the file here...</p>
            ) : (
              <div>
                <p className="text-lg font-bold text-foreground mb-2">
                  Drop a bill here, or browse
                </p>
                <p className="text-sm text-muted">Supports images (PNG, JPG) and PDF files</p>
              </div>
            )}
          </div>

          {file && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white/60 p-4"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <button
                onClick={uploadFile}
                disabled={isUploading}
                className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-cream transition-transform active:scale-95 disabled:opacity-50"
              >
                {isUploading ? <WorkingState label="Reading bill" /> : 'Extract details'}
              </button>
              <button
                aria-label="Remove selected file"
                onClick={(event) => {
                  event.stopPropagation();
                  setFile(null);
                  setResult(null);
                  setError('');
                }}
                className="grid size-10 place-items-center rounded-full border border-ink/10 text-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          )}
          {error && (
            <p role="alert" className="mt-5 rounded-2xl border border-red-900/10 bg-red-50 p-4 text-sm font-semibold text-red-900">
              {error}
            </p>
          )}
        </motion.div>

        {/* Results */}
        <section className="rounded-[2rem] bg-ink p-6 text-cream shadow-[0_30px_80px_rgba(25,20,15,0.2)] sm:p-8">
        {result ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className=""
          >
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="size-7 text-[#6ee7b7]" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron">Document understood</p>
                <h3 className="mt-1 text-3xl font-semibold">Extracted entry</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-muted mb-1">Date</p>
                <p className="text-lg font-medium text-white/90">{result.transaction.date}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Amount</p>
                <p className="text-3xl font-display font-bold text-saffron">
                  ₹{result.transaction.amount.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Category</p>
                <p className="text-lg font-medium capitalize text-white/90">{result.transaction.category}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Vendor</p>
                <p className="text-lg font-medium text-white/90">{result.transaction.vendor}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted mb-2">Description</p>
              <p className="leading-7 text-white/78">{result.transaction.description}</p>
            </div>

            <p className="mt-6 rounded-xl border border-[#6ee7b7]/20 bg-[#6ee7b7]/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[#9ff4ce]">
              Saved to this device · {(result.record_id || 'local record').slice(-8)}
            </p>

            {result.extracted_text && (
              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-bold text-saffron">
                  View Raw Extracted Text
                </summary>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.05] p-4 text-xs text-white/65">
                  {result.extracted_text}
                </pre>
              </details>
            )}
          </motion.div>
        ) : (
          <div className="flex min-h-[430px] flex-col justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-saffron">What you will get</p>
            <div>
              <p className="font-display text-4xl font-bold leading-[1.02] text-white/92">
                Date, amount, category, vendor, and a readable description.
              </p>
              <p className="mt-5 max-w-lg text-sm leading-7 text-white/48">
                The raw extraction stays available underneath, so you can check what the model saw.
              </p>
            </div>
          </div>
        )}
        </section>
      </div>
    </main>
  );
}
