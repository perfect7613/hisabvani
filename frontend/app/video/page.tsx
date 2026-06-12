'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Download,
  Film,
  Languages,
  LoaderCircle,
  Music2,
  Play,
  Share2,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { apiUrl, readApiError } from '@/lib/api';
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
  amount: number;
  category: string;
  description: string;
  duration_seconds: number;
  audio_provider: string;
  music_name?: string;
  sound_effect_name?: string;
  language_code: string;
  language_name: string;
};

type ReadyVideo = VideoResult & {
  streamUrl: string;
};

type VideoJobCreated = {
  job_id: string;
  status: string;
  status_url: string;
};

type VideoJobStatus = {
  job_id: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed';
  result?: VideoResult;
  error?: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong while generating the video.';
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export default function VideoReports() {
  const [transactionId, setTransactionId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [languageCode, setLanguageCode] = useState('en-IN');
  const [video, setVideo] = useState<ReadyVideo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [error, setError] = useState('');

  const generateVideo = async () => {
    setIsLoading(true);
    setIsPlayerReady(false);
    setError('');
    setVideo(null);

    try {
      const payload = transactionId
        ? {
            transaction_id: Number.parseInt(transactionId, 10),
            language_code: languageCode,
          }
        : {
            title: title || 'Expense Report',
            amount: Number.parseFloat(amount) || 0,
            category: category || 'other',
            description: description || '',
            language_code: languageCode,
          };

      const response = await fetch(apiUrl('/api/generate-video'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as VideoJobCreated & {
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(data.detail || await readApiError(response, 'Failed to generate video'));
      }

      const statusUrl = apiUrl(data.status_url);
      let result: VideoResult | undefined;

      for (let attempt = 0; attempt < 900; attempt += 1) {
        await wait(attempt === 0 ? 500 : 2_000);
        const statusResponse = await fetch(statusUrl, { cache: 'no-store' });
        const job = (await statusResponse.json()) as VideoJobStatus & {
          detail?: string;
        };

        if (!statusResponse.ok) {
          throw new Error(job.detail || 'Could not check the video render status.');
        }
        if (job.status === 'failed') {
          throw new Error(job.error || 'Video rendering failed.');
        }
        if (job.status === 'completed' && job.result) {
          result = job.result;
          break;
        }
      }

      if (!result) {
        throw new Error('Video rendering timed out after 30 minutes.');
      }

      setVideo({
        ...result,
        streamUrl: apiUrl(result.video_url),
      });
    } catch (requestError: unknown) {
      setError(errorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  const downloadVideo = () => {
    if (!video) return;
    window.location.assign(`${video.streamUrl}?download=true`);
  };

  const shareVideo = async () => {
    if (!video) return;
    setIsSharing(true);
    setError('');

    try {
      const response = await fetch(video.streamUrl);
      if (!response.ok) throw new Error('Could not prepare the video for sharing.');
      const blob = await response.blob();
      const file = new File([blob], `hisabvani-${video.video_id}.mp4`, {
        type: 'video/mp4',
      });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: video.title,
          text: `HisabVani expense report for ₹${video.amount.toLocaleString('en-IN')}`,
          files: [file],
        });
      } else {
        downloadVideo();
      }
    } catch (shareError: unknown) {
      setError(errorMessage(shareError));
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3eadb] text-[#17130f]">
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
        <div className="mb-9 grid gap-6 lg:grid-cols-[1fr_0.62fr] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#065f46]/20 bg-[#065f46]/8 px-4 py-2 text-sm font-semibold text-[#065f46]">
              <Sparkles className="size-4" />
              HyperFrames + HeyGen audio
            </div>
            <h1 className="max-w-4xl text-5xl font-bold leading-[0.92] tracking-[-0.055em] sm:text-7xl">
              Give one expense a beginning, middle, and end.
            </h1>
          </div>
          <div>
            <ServiceNotice compact />
            <p className="mt-3 text-xs leading-5 text-[#766c61]">
              Free Render storage is temporary. Download completed films before the service sleeps or redeploys.
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr]">
        <motion.section
          initial={{ opacity: 0, transform: 'translateY(16px)' }}
          animate={{ opacity: 1, transform: 'translateY(0)' }}
          transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-[2rem] border border-[#17130f]/10 bg-[#fffaf0] p-6 shadow-[0_24px_80px_rgba(83,57,27,0.09)] sm:p-8"
        >
          <div className="mb-8 flex items-start justify-between gap-5">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#d97706]">
                Build your story
              </p>
              <h2 className="max-w-md text-4xl font-bold leading-[0.98] tracking-[-0.04em] sm:text-5xl">
                Turn one expense into a film.
              </h2>
            </div>
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#17130f] text-[#f4b942]">
              <Film className="size-7" />
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="transaction-id" className="mb-2 block text-sm font-semibold">
                Use a saved transaction
              </label>
              <input
                id="transaction-id"
                type="number"
                value={transactionId}
                onChange={(event) => setTransactionId(event.target.value)}
                placeholder="Transaction ID"
                className="w-full rounded-xl border border-[#17130f]/15 bg-white px-4 py-3.5 outline-none transition-[border-color,box-shadow] focus:border-[#d97706] focus:ring-4 focus:ring-[#d97706]/10"
              />
            </div>

            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f73]">
              <span className="h-px flex-1 bg-[#17130f]/10" />
              or enter it manually
              <span className="h-px flex-1 bg-[#17130f]/10" />
            </div>

            <div>
              <label htmlFor="video-language" className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Languages className="size-4 text-[#965307]" />
                Video language
              </label>
              <select
                id="video-language"
                value={languageCode}
                onChange={(event) => setLanguageCode(event.target.value)}
                className="w-full rounded-xl border border-[#17130f]/15 bg-white px-4 py-3.5 outline-none transition-[border-color,box-shadow] focus:border-[#d97706] focus:ring-4 focus:ring-[#d97706]/10"
              >
                {VIDEO_LANGUAGES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-[#8a7f73]">
                Sarvam translates every scene before the composition is sent to Daytona.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Report title"
                disabled={Boolean(transactionId)}
                className="rounded-xl border border-[#17130f]/15 bg-white px-4 py-3.5 outline-none transition-[border-color,box-shadow] focus:border-[#d97706] focus:ring-4 focus:ring-[#d97706]/10 disabled:opacity-45"
              />
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#965307]">
                  ₹
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Amount"
                  disabled={Boolean(transactionId)}
                  className="w-full rounded-xl border border-[#17130f]/15 bg-white py-3.5 pl-9 pr-4 outline-none transition-[border-color,box-shadow] focus:border-[#d97706] focus:ring-4 focus:ring-[#d97706]/10 disabled:opacity-45"
                />
              </div>
            </div>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={Boolean(transactionId)}
              className="w-full rounded-xl border border-[#17130f]/15 bg-white px-4 py-3.5 outline-none transition-[border-color,box-shadow] focus:border-[#d97706] focus:ring-4 focus:ring-[#d97706]/10 disabled:opacity-45"
            >
              <option value="">Choose a category</option>
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
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What was this expense for?"
              rows={3}
              maxLength={90}
              disabled={Boolean(transactionId)}
              className="w-full resize-none rounded-xl border border-[#17130f]/15 bg-white px-4 py-3.5 outline-none transition-[border-color,box-shadow] focus:border-[#d97706] focus:ring-4 focus:ring-[#d97706]/10 disabled:opacity-45"
            />

            <button
              onClick={generateVideo}
              disabled={isLoading || (!transactionId && !amount)}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#17130f] px-6 py-4 font-bold text-[#fff8e9] shadow-[0_12px_30px_rgba(23,19,15,0.16)] transition-[transform,background-color] duration-150 active:scale-[0.98] hover:bg-[#2a231c] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="size-5 animate-spin" />
                  Rendering in Daytona
                </>
              ) : (
                <>
                  <Play className="size-5 fill-current" />
                  Generate 12-second film
                </>
              )}
            </button>
          </div>

          {error && (
            <div role="alert" className="mt-5 rounded-xl border border-red-900/15 bg-red-50 p-4 text-sm font-medium text-red-900">
              {error}
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, transform: 'translateY(20px)' }}
          animate={{ opacity: 1, transform: 'translateY(0)' }}
          transition={{ delay: 0.08, duration: 0.48, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden rounded-[2rem] bg-[#17130f] p-4 text-[#f7eedc] shadow-[0_30px_90px_rgba(23,19,15,0.24)] sm:p-6"
        >
          <div className="mb-5 flex items-center justify-between px-2 pt-1">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f4b942]">
                Final render
              </p>
              <h2 className="mt-1 text-2xl font-bold">Your household story</h2>
            </div>
            <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/65">
              1920 × 1080
            </span>
          </div>

          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[#221b15]">
            {video ? (
              <>
                {!isPlayerReady && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-[#221b15]">
                    <LoaderCircle className="size-7 animate-spin text-[#f4b942]" />
                  </div>
                )}
                <video
                  key={video.streamUrl}
                  src={video.streamUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedData={() => setIsPlayerReady(true)}
                  onError={() => setError('The video was rendered but the browser could not load the stream.')}
                  className="h-full w-full object-contain"
                />
              </>
            ) : isLoading ? (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <div className="relative mb-7 grid size-20 place-items-center rounded-full border border-[#f4b942]/25">
                  <span className="absolute inset-0 animate-ping rounded-full border border-[#f4b942]/20" />
                  <LoaderCircle className="size-8 animate-spin text-[#f4b942]" />
                </div>
                <p className="text-xl font-bold">Composing the frames</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-white/55">
                  Translating with Sarvam, searching HeyGen audio, rendering HyperFrames, validating the MP4, then downloading it before the sandbox closes.
                  </p>
              </div>
            ) : (
              <div className="relative flex h-full flex-col justify-between overflow-hidden p-8 sm:p-10">
                <div className="absolute -right-24 -top-24 size-80 rounded-full bg-[#d97706]/20 blur-3xl" />
                <div className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f4b942]">
                  <span className="h-0.5 w-12 bg-[#f4b942]" />
                  Ready when you are
                </div>
                <div className="relative">
                  <p className="max-w-lg text-4xl font-bold leading-[0.98] tracking-[-0.04em] sm:text-5xl">
                    Your expense deserves more than a static card.
                  </p>
                  <p className="mt-4 max-w-md text-sm leading-6 text-white/55">
                    Generate a tactile, shareable MP4 with editorial motion and licensed catalog audio.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <Music2 className="mb-3 size-5 text-[#f4b942]" />
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Music</p>
              <p className="mt-1 truncate text-sm font-semibold">{video?.music_name || 'HeyGen catalog'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <Volume2 className="mb-3 size-5 text-[#f4b942]" />
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Sound effect</p>
              <p className="mt-1 truncate text-sm font-semibold">{video?.sound_effect_name || 'Receipt transition'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <Check className="mb-3 size-5 text-[#6ee7b7]" />
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Delivery</p>
              <p className="mt-1 text-sm font-semibold">{video ? 'Downloaded safely' : 'MP4 after validation'}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
            <span className="flex items-center gap-2 text-white/55">
              <Languages className="size-4 text-[#f4b942]" />
              Video language
            </span>
            <strong>{video?.language_name || VIDEO_LANGUAGES.find(([code]) => code === languageCode)?.[1]}</strong>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={downloadVideo}
              disabled={!video}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#f7eedc] px-5 py-3.5 font-bold text-[#17130f] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Download className="size-5" />
              Download
            </button>
            <button
              onClick={shareVideo}
              disabled={!video || isSharing}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3.5 font-bold transition-[transform,background-color] duration-150 active:scale-[0.98] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {isSharing ? <LoaderCircle className="size-5 animate-spin" /> : <Share2 className="size-5" />}
              Share
            </button>
          </div>
        </motion.section>
        </div>
      </main>
    </div>
  );
}
