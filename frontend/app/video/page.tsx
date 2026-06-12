'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Check,
  Clapperboard,
  Download,
  FileScan,
  Film,
  Languages,
  LoaderCircle,
  MessageCircleMore,
  Mic2,
  Music2,
  Play,
  ReceiptText,
  Share2,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { apiUrl, readApiError } from '@/lib/api';
import {
  seedDemoHouseholdLedger,
  useHouseholdLedger,
} from '@/lib/household-ledger';
import { ServiceNotice } from '../components/service-notice';

const VIDEO_LANGUAGES = [
  ['en-IN', 'English'],
  ['hi-IN', 'हिन्दी · Hindi'],
  ['bn-IN', 'বাংলা · Bengali'],
  ['gu-IN', 'ગુજરાતી · Gujarati'],
  ['kn-IN', 'ಕನ್ನಡ · Kannada'],
  ['ml-IN', 'മലയാളം · Malayalam'],
  ['mr-IN', 'मराठी · Marathi'],
  ['od-IN', 'ଓଡ଼ିଆ · Odia'],
  ['pa-IN', 'ਪੰਜਾਬੀ · Punjabi'],
  ['ta-IN', 'தமிழ் · Tamil'],
  ['te-IN', 'తెలుగు · Telugu'],
  ['ur-IN', 'اردو · Urdu'],
  ['as-IN', 'অসমীয়া · Assamese'],
  ['brx-IN', 'बड़ो · Bodo'],
  ['doi-IN', 'डोगरी · Dogri'],
  ['kok-IN', 'कोंकणी · Konkani'],
  ['ks-IN', 'کٲشُر · Kashmiri'],
  ['mai-IN', 'मैथिली · Maithili'],
  ['mni-IN', 'মৈতৈলোন্ · Manipuri'],
  ['ne-IN', 'नेपाली · Nepali'],
  ['sa-IN', 'संस्कृतम् · Sanskrit'],
  ['sat-IN', 'ᱥᱟᱱᱛᱟᱲᱤ · Santali'],
  ['sd-IN', 'سنڌي · Sindhi'],
] as const;

type VideoResult = {
  video_id: string;
  video_url: string;
  title: string;
  total_amount: number;
  transaction_count: number;
  conversation_count: number;
  duration_seconds: number;
  audio_provider: string;
  music_name?: string;
  sound_effect_name?: string;
  language_code: string;
  language_name: string;
};

type ReadyVideo = VideoResult & { streamUrl: string };
type VideoJobCreated = { job_id: string; status: string; status_url: string };
type VideoJobStatus = {
  job_id: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed';
  result?: VideoResult;
  error?: string;
};

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong while generating the report.';
}

function cleanConversationPreview(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/[`*_#>-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function VideoReports() {
  const ledger = useHouseholdLedger();
  const initializedTransactions = useRef(false);
  const initializedConversations = useRef(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [languageCode, setLanguageCode] = useState('en-IN');
  const [video, setVideo] = useState<ReadyVideo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initializedTransactions.current && ledger.transactions.length > 0) {
      setSelectedTransactionIds(ledger.transactions.map((item) => item.id));
      initializedTransactions.current = true;
    }
  }, [ledger.transactions]);

  useEffect(() => {
    if (!initializedConversations.current && ledger.conversations.length > 0) {
      setSelectedConversationIds(ledger.conversations.map((item) => item.id));
      initializedConversations.current = true;
    }
  }, [ledger.conversations]);

  const selectedTransactions = useMemo(
    () => ledger.transactions.filter((item) => selectedTransactionIds.includes(item.id)),
    [ledger.transactions, selectedTransactionIds],
  );
  const selectedConversations = useMemo(
    () => ledger.conversations.filter((item) => selectedConversationIds.includes(item.id)),
    [ledger.conversations, selectedConversationIds],
  );
  const selectedTotal = selectedTransactions.reduce((sum, item) => sum + item.amount, 0);

  const toggleSelection = (
    id: string,
    selected: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter(selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id]);
  };

  const generateVideo = async () => {
    if (selectedTransactions.length === 0) return;
    setIsLoading(true);
    setIsPlayerReady(false);
    setError('');
    setVideo(null);

    try {
      const response = await fetch(apiUrl('/api/generate-video'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || undefined,
          language_code: languageCode,
          transactions: selectedTransactions.map((item) => ({
            id: item.id,
            date: item.date,
            amount: item.amount,
            category: item.category,
            vendor: item.vendor,
            description: item.description,
            source: item.source,
          })),
          conversations: selectedConversations.map((item) => ({
            id: item.id,
            question: item.question,
            answer: item.answer,
            created_at: item.createdAt,
          })),
        }),
      });
      const created = (await response.json()) as VideoJobCreated & { detail?: string };
      if (!response.ok) {
        throw new Error(created.detail || await readApiError(response, 'Failed to generate report'));
      }

      let result: VideoResult | undefined;
      for (let attempt = 0; attempt < 900; attempt += 1) {
        await wait(attempt === 0 ? 500 : 2_000);
        const statusResponse = await fetch(apiUrl(created.status_url), { cache: 'no-store' });
        const job = (await statusResponse.json()) as VideoJobStatus & { detail?: string };
        if (!statusResponse.ok) throw new Error(job.detail || 'Could not check render status.');
        if (job.status === 'failed') throw new Error(job.error || 'Video rendering failed.');
        if (job.status === 'completed' && job.result) {
          result = job.result;
          break;
        }
      }
      if (!result) throw new Error('Video rendering timed out after 30 minutes.');
      setVideo({ ...result, streamUrl: apiUrl(result.video_url) });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  const downloadVideo = () => {
    if (video) window.location.assign(`${video.streamUrl}?download=true`);
  };

  const shareVideo = async () => {
    if (!video) return;
    setIsSharing(true);
    setError('');
    try {
      const response = await fetch(video.streamUrl);
      if (!response.ok) throw new Error('Could not prepare the video for sharing.');
      const blob = await response.blob();
      const file = new File([blob], `hisabvani-${video.video_id}.mp4`, { type: 'video/mp4' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: video.title,
          text: `HisabVani household report for ₹${video.total_amount.toLocaleString('en-IN')}`,
          files: [file],
        });
      } else {
        downloadVideo();
      }
    } catch (shareError) {
      setError(errorMessage(shareError));
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <main className="mx-auto min-h-[calc(100vh-70px)] max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
      <div className="mb-10 grid gap-7 lg:grid-cols-[1fr_0.62fr] lg:items-end">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-leaf/20 bg-leaf/8 px-4 py-2 text-sm font-bold text-leaf">
            <Sparkles className="size-4" />
            Sarvam 105B + HyperFrames + HeyGen audio
          </div>
          <h1 className="max-w-5xl text-5xl font-bold leading-[0.92] tracking-[-0.055em] sm:text-7xl">
            Turn the month into one family money story.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-ink/60">
            Choose locally saved voice entries, scanned bills, and financial conversations. Sarvam 105B reasons over the selection, then HyperFrames renders an 18-second multilingual report.
          </p>
        </div>
        <div>
          <ServiceNotice compact />
          <p className="mt-3 text-xs leading-5 text-muted">
            Your ledger stays in this browser. Only the selected report data is sent for generation.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1.04fr)_minmax(32rem,0.96fr)]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="paper-card min-w-0 rounded-[2rem] p-6 sm:p-8"
        >
          <div className="mb-7 flex items-start justify-between gap-5">
            <div>
              <p className="eyebrow">Report ingredients</p>
              <h2 className="mt-2 text-4xl font-bold">Choose what the film remembers.</h2>
            </div>
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink text-saffron">
              <Clapperboard className="size-7" />
            </span>
          </div>

          {ledger.transactions.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-ink/15 bg-white/45 p-7">
              <p className="text-2xl font-bold">Your local ledger is empty.</p>
              <p className="mt-2 text-sm leading-6 text-muted">Add at least one expense before creating a report.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link href="/expense" className="flex items-center gap-3 rounded-xl bg-ink px-4 py-3 font-bold text-cream">
                  <Mic2 className="size-5 text-saffron" /> Record an expense
                </Link>
                <Link href="/upload" className="flex items-center gap-3 rounded-xl border border-ink/12 bg-white px-4 py-3 font-bold">
                  <FileScan className="size-5 text-copper" /> Scan a bill
                </Link>
              </div>
              <button
                onClick={seedDemoHouseholdLedger}
                className="mt-3 w-full rounded-xl border border-copper/20 bg-saffron/15 px-4 py-3 text-sm font-bold text-copper"
              >
                Load a local demo household
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-bold">Transactions</p>
                <button
                  onClick={() => setSelectedTransactionIds(
                    selectedTransactionIds.length === ledger.transactions.length
                      ? []
                      : ledger.transactions.map((item) => item.id),
                  )}
                  className="text-xs font-bold text-copper"
                >
                  {selectedTransactionIds.length === ledger.transactions.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {ledger.transactions.map((transaction) => {
                  const checked = selectedTransactionIds.includes(transaction.id);
                  return (
                    <label
                      key={transaction.id}
                      className={`flex min-w-0 cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${
                        checked ? 'border-copper/35 bg-saffron/12' : 'border-ink/10 bg-white/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelection(
                          transaction.id,
                          selectedTransactionIds,
                          setSelectedTransactionIds,
                        )}
                        className="size-4 accent-copper"
                      />
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                        transaction.source === 'bill' ? 'bg-leaf/10 text-leaf' : 'bg-copper/10 text-copper'
                      }`}>
                        {transaction.source === 'bill' ? <ReceiptText className="size-5" /> : <Mic2 className="size-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block line-clamp-2 break-words text-sm">{transaction.description || transaction.vendor}</strong>
                        <span className="text-xs capitalize text-muted">{transaction.category} · {transaction.date}</span>
                      </span>
                      <strong className="shrink-0 font-display text-lg">₹{transaction.amount.toLocaleString('en-IN')}</strong>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          <div className="my-7 border-t border-dashed border-ink/15" />

          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Finance conversations</p>
              <p className="mt-1 text-xs text-muted">Included as summarized advice scenes.</p>
            </div>
            {ledger.conversations.length > 0 && (
              <button
                onClick={() => setSelectedConversationIds(
                  selectedConversationIds.length === ledger.conversations.length
                    ? []
                    : ledger.conversations.map((item) => item.id),
                )}
                className="text-xs font-bold text-copper"
              >
                {selectedConversationIds.length === ledger.conversations.length ? 'Clear all' : 'Select all'}
              </button>
            )}
          </div>

          {ledger.conversations.length === 0 ? (
            <Link href="/voice" className="flex items-center justify-between rounded-xl border border-dashed border-ink/15 bg-white/40 p-4">
              <span className="flex items-center gap-3 text-sm font-bold">
                <MessageCircleMore className="size-5 text-copper" /> Ask a grounded finance question
              </span>
              <span className="text-xs text-muted">Optional</span>
            </Link>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {ledger.conversations.map((conversation) => {
                const checked = selectedConversationIds.includes(conversation.id);
                return (
                  <label key={conversation.id} className={`flex min-w-0 cursor-pointer gap-3 overflow-hidden rounded-xl border p-4 ${
                    checked ? 'border-leaf/30 bg-leaf/8' : 'border-ink/10 bg-white/50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelection(
                        conversation.id,
                        selectedConversationIds,
                        setSelectedConversationIds,
                      )}
                      className="mt-1 size-4 accent-leaf"
                    />
                    <span className="min-w-0 flex-1">
                      <strong className="block line-clamp-2 break-words text-sm leading-5 [overflow-wrap:anywhere]">
                        {cleanConversationPreview(conversation.question)}
                      </strong>
                      <span className="mt-1 block line-clamp-3 break-words text-xs leading-5 text-muted [overflow-wrap:anywhere]">
                        {cleanConversationPreview(conversation.answer)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="report-title" className="mb-2 block text-sm font-bold">Optional title</label>
              <input
                id="report-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Let Sarvam name it"
                maxLength={60}
                className="field"
              />
            </div>
            <div>
              <label htmlFor="video-language" className="mb-2 flex items-center gap-2 text-sm font-bold">
                <Languages className="size-4 text-copper" /> Video language
              </label>
              <select
                id="video-language"
                value={languageCode}
                onChange={(event) => setLanguageCode(event.target.value)}
                className="field"
              >
                {VIDEO_LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-ink p-4 text-cream">
            <div><span className="block text-xs text-white/45">Expenses</span><strong>{selectedTransactions.length}</strong></div>
            <div><span className="block text-xs text-white/45">Questions</span><strong>{selectedConversations.length}</strong></div>
            <div><span className="block text-xs text-white/45">Total</span><strong>₹{selectedTotal.toLocaleString('en-IN')}</strong></div>
          </div>

          <button
            onClick={generateVideo}
            disabled={isLoading || selectedTransactions.length === 0}
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl bg-copper px-6 py-4 font-bold text-white shadow-[0_12px_30px_rgba(169,86,19,0.2)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isLoading ? <><LoaderCircle className="size-5 animate-spin" /> Rendering in Daytona</> : <><Play className="size-5 fill-current" /> Generate family report</>}
          </button>
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-900/15 bg-red-50 p-4 text-sm font-semibold text-red-900">{error}</p>}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="min-w-0 self-start overflow-hidden rounded-[2rem] bg-ink p-4 text-cream shadow-[0_30px_90px_rgba(23,19,15,0.24)] sm:p-6 xl:sticky xl:top-24"
        >
          <div className="mb-5 flex items-start justify-between gap-4 px-2 pt-1">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-saffron">Final render</p>
              <h2 className="mt-1 text-2xl font-bold leading-tight">The household briefing</h2>
            </div>
            <span className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/65">18 sec · 4 scenes</span>
          </div>

          <div className="relative aspect-video min-h-72 overflow-hidden rounded-2xl border border-white/10 bg-[#221b15]">
            {video ? (
              <>
                {!isPlayerReady && <div className="absolute inset-0 z-10 grid place-items-center bg-[#221b15]"><LoaderCircle className="size-7 animate-spin text-saffron" /></div>}
                <video
                  key={video.streamUrl}
                  src={video.streamUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedData={() => setIsPlayerReady(true)}
                  onError={() => setError('The video rendered, but the browser could not load its stream.')}
                  className="h-full w-full object-contain"
                />
              </>
            ) : isLoading ? (
              <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6 py-8 text-center sm:px-10">
                <div className="absolute inset-x-12 top-1/2 h-24 -translate-y-1/2 rounded-full bg-copper/20 blur-3xl" />
                <span className="relative mb-5 grid size-14 place-items-center rounded-2xl border border-saffron/25 bg-saffron/10">
                  <LoaderCircle className="size-7 animate-spin text-saffron" />
                </span>
                <p className="relative text-[0.65rem] font-bold uppercase tracking-[0.2em] text-saffron">Daytona render in progress</p>
                <p className="relative mt-2 font-display text-2xl font-bold leading-tight">Building your family money story</p>
                <p className="relative mt-3 max-w-sm text-sm leading-6 text-white/58">Sarvam reasons, translates, and hands the finished story to HyperFrames.</p>
                <div className="relative mt-5 flex flex-wrap justify-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white/55">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Reasoning</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Localization</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Animation</span>
                </div>
              </div>
            ) : (
              <div className="relative flex h-full flex-col justify-between overflow-hidden p-8 sm:p-10">
                <div className="absolute -right-24 -top-24 size-80 rounded-full bg-copper/25 blur-3xl" />
                <div className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-saffron">
                  <span className="h-0.5 w-12 bg-saffron" /> Four-scene report
                </div>
                <div className="relative max-w-xl">
                  <Film className="mb-5 size-10 text-saffron" />
                  <p className="font-display text-4xl font-bold leading-[0.98] sm:text-5xl">Transactions become context. Questions become advice.</p>
                  <p className="mt-4 text-sm leading-6 text-white/55">The film covers the total, selected expenses, Sarvam’s grounded insight, and a practical family takeaway.</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
            <div className="flex min-w-0 items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-saffron/10"><Music2 className="size-5 text-saffron" /></span>
              <span className="min-w-0"><span className="block text-[0.65rem] uppercase tracking-[0.16em] text-white/45">Music</span><strong className="mt-1 block break-words text-sm">{video?.music_name || 'HeyGen catalog'}</strong></span>
            </div>
            <div className="flex min-w-0 items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-saffron/10"><Volume2 className="size-5 text-saffron" /></span>
              <span className="min-w-0"><span className="block text-[0.65rem] uppercase tracking-[0.16em] text-white/45">Transitions</span><strong className="mt-1 block break-words text-sm">{video?.sound_effect_name || 'Paper + ledger cues'}</strong></span>
            </div>
            <div className="flex min-w-0 items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#6ee7b7]/10"><Check className="size-5 text-[#6ee7b7]" /></span>
              <span className="min-w-0"><span className="block text-[0.65rem] uppercase tracking-[0.16em] text-white/45">Included</span><strong className="mt-1 block break-words text-sm">{video ? `${video.transaction_count} expenses · ${video.conversation_count} asks` : 'Your selected records'}</strong></span>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button onClick={downloadVideo} disabled={!video} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cream px-5 py-3.5 font-bold text-ink disabled:opacity-35"><Download className="size-5" /> Download</button>
            <button onClick={shareVideo} disabled={!video || isSharing} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3.5 font-bold disabled:opacity-35">{isSharing ? <LoaderCircle className="size-5 animate-spin" /> : <Share2 className="size-5" />} Share</button>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
