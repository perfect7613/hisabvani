'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BillUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
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
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:8000/api/upload-bill', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error('Error uploading file:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6">
          <Link href="/" className="text-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-3xl font-display font-bold text-primary">Upload Bill</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-border p-8 mb-8"
        >
          <h2 className="text-2xl font-display font-semibold mb-6">Upload Your Bill or Receipt</h2>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-primary bg-accent/50'
                : 'border-border hover:border-primary hover:bg-accent/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept="image/*,.pdf"
              className="hidden"
            />
            <Upload className="w-16 h-16 mx-auto mb-4 text-muted" />
            {isDragActive ? (
              <p className="text-lg text-primary font-medium">Drop the file here...</p>
            ) : (
              <div>
                <p className="text-lg text-foreground mb-2">
                  Drag & drop your bill here, or click to select
                </p>
                <p className="text-sm text-muted">Supports images (PNG, JPG) and PDF files</p>
              </div>
            )}
          </div>

          {file && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 flex items-center justify-between bg-accent/30 rounded-xl p-4"
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
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Processing...' : 'Extract Data'}
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* Results */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-border p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-8 h-8 text-secondary" />
              <h3 className="text-2xl font-display font-semibold">Extracted Data</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-muted mb-1">Date</p>
                <p className="text-lg font-medium">{result.transaction.date}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Amount</p>
                <p className="text-2xl font-display font-bold text-primary">
                  ₹{result.transaction.amount.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Category</p>
                <p className="text-lg font-medium capitalize">{result.transaction.category}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Vendor</p>
                <p className="text-lg font-medium">{result.transaction.vendor}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted mb-2">Description</p>
              <p className="text-foreground">{result.transaction.description}</p>
            </div>

            {result.extracted_text && (
              <details className="mt-6">
                <summary className="cursor-pointer text-sm text-primary hover:text-primary-light">
                  View Raw Extracted Text
                </summary>
                <pre className="mt-3 p-4 bg-border/30 rounded-lg text-sm overflow-x-auto">
                  {result.extracted_text}
                </pre>
              </details>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
