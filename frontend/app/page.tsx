'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  FileScan,
  Film,
  IndianRupee,
  Mic2,
  PiggyBank,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiUrl } from '@/lib/api';
import { ServiceNotice } from './components/service-notice';

const COLORS = ['#b35d16', '#e6a32c', '#155e4b', '#739169', '#766c61'];

const fallbackCategories = [
  { name: 'Education', value: 20000 },
  { name: 'Medical', value: 8000 },
  { name: 'Rent', value: 18000 },
  { name: 'Utilities', value: 5000 },
];

const monthlyTrend = [
  { month: 'Apr', amount: 44000 },
  { month: 'May', amount: 47500 },
  { month: 'Jun', amount: 51000 },
];

type SampleData = {
  total_expenses: number;
  expenses_by_category: Record<string, number>;
  count: number;
};

const actions = [
  {
    href: '/expense',
    label: 'Voice khata',
    kicker: 'Speak an expense',
    copy: 'Say “petrol 500 ka” and let HisabVani write the entry.',
    icon: WalletCards,
    tone: 'bg-[#a95613] text-[#fff9ed]',
  },
  {
    href: '/voice',
    label: 'Ask HisabVani',
    kicker: 'Understand your money',
    copy: 'Ask a finance question naturally in your own language.',
    icon: Mic2,
    tone: 'bg-[#155e4b] text-[#fff9ed]',
  },
  {
    href: '/upload',
    label: 'Scan a bill',
    kicker: 'Turn paper into data',
    copy: 'Upload a receipt and extract the useful transaction details.',
    icon: FileScan,
    tone: 'bg-[#f2b33d] text-[#19140f]',
  },
  {
    href: '/video',
    label: 'Make a film',
    kicker: 'Share the story',
    copy: 'Render a multilingual expense film with licensed audio.',
    icon: Film,
    tone: 'bg-[#19140f] text-[#fff9ed]',
  },
];

export default function Dashboard() {
  const [mode, setMode] = useState(0);
  const [sampleData, setSampleData] = useState<SampleData | null>(null);
  const [backendState, setBackendState] = useState<'checking' | 'live' | 'sleeping'>('checking');

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        const response = await fetch(apiUrl('/api/sample-data'), {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Backend unavailable');
        setSampleData((await response.json()) as SampleData);
        setBackendState('live');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setBackendState('sleeping');
      }
    }

    void loadData();
    return () => controller.abort();
  }, []);

  const categories = useMemo(() => {
    if (!sampleData || Object.keys(sampleData.expenses_by_category).length === 0) {
      return fallbackCategories;
    }
    return Object.entries(sampleData.expenses_by_category).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [sampleData]);

  const totalExpenses = sampleData?.total_expenses || 51000;
  const income = 85000;
  const savings = Math.max(income - totalExpenses, 0);

  return (
    <main className="overflow-hidden">
      <section className="relative border-b border-ink/10">
        <div className="ledger-grid absolute inset-0 opacity-55" />
        <div className="absolute -right-24 top-10 size-80 rounded-full bg-saffron/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-copper/15 bg-cream/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-copper">
              <Sparkles className="size-4" />
              Multilingual family finance
            </div>
            <h1 className="text-balance font-display text-5xl font-bold leading-[0.92] tracking-[-0.055em] sm:text-7xl">
              Money feels lighter when the whole family understands it.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-ink/62">
              Speak an expense, scan a bill, ask a question, or turn one transaction into a film. HisabVani keeps the experience familiar, visual, and multilingual.
            </p>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, rotate: 2, y: 24 }}
            animate={{ opacity: 1, rotate: -1.5, y: 0 }}
            transition={{ delay: 0.08 }}
            className="paper-card self-end rounded-[2rem] p-6 sm:p-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">June household note</p>
                <p className="mt-3 font-display text-4xl font-bold tracking-[-0.04em]">
                  ₹{totalExpenses.toLocaleString('en-IN')}
                </p>
                <p className="mt-1 text-sm text-muted">tracked expenses</p>
              </div>
              <span
                className={`mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                  backendState === 'live'
                    ? 'bg-leaf/10 text-leaf'
                    : 'bg-saffron/15 text-copper'
                }`}
              >
                <span className={`size-2 rounded-full ${backendState === 'live' ? 'bg-leaf' : 'bg-saffron'}`} />
                {backendState === 'checking' ? 'Checking' : backendState === 'live' ? 'Service live' : 'Demo data'}
              </span>
            </div>
            <div className="my-6 border-t border-dashed border-ink/15" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{sampleData?.count ?? 0} saved entries</span>
              <span className="font-bold text-leaf">₹{savings.toLocaleString('en-IN')} available</span>
            </div>
          </motion.aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
        {backendState === 'sleeping' && (
          <div className="mb-7">
            <ServiceNotice />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Household income', value: income, icon: IndianRupee, note: 'Monthly working figure' },
            { label: 'Expenses tracked', value: totalExpenses, icon: WalletCards, note: sampleData ? 'From your saved entries' : 'Illustrative dashboard data' },
            { label: 'Room to save', value: savings, icon: PiggyBank, note: 'Income minus tracked spend' },
          ].map((card, index) => (
            <motion.article
              key={card.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.07 }}
              className="paper-card rounded-[1.6rem] p-6"
            >
              <div className="mb-8 flex items-center justify-between">
                <p className="text-sm font-bold text-ink/58">{card.label}</p>
                <span className="grid size-10 place-items-center rounded-xl bg-ink/5 text-copper">
                  <card.icon className="size-5" />
                </span>
              </div>
              <p className="font-display text-4xl font-bold tracking-[-0.04em]">
                ₹{card.value.toLocaleString('en-IN')}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted">{card.note}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="paper-card rounded-[1.8rem] p-6 sm:p-8">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="eyebrow">Where it went</p>
                <h2 className="mt-2 text-2xl font-bold">Expense mix</h2>
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">By category</span>
            </div>
            <ResponsiveContainer width="100%" height={285}>
              <PieChart>
                <Pie data={categories} dataKey="value" innerRadius={62} outerRadius={102} paddingAngle={3} stroke="none">
                  {categories.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {categories.slice(0, 5).map((item, index) => (
                <span key={item.name} className="flex items-center gap-2 text-xs font-semibold text-ink/60">
                  <span className="size-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  {item.name}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-[1.8rem] bg-ink p-6 text-cream shadow-[0_28px_80px_rgba(25,20,15,0.18)] sm:p-8">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-saffron">Conversation style</p>
                <h2 className="mt-2 text-3xl font-bold">How should HisabVani explain?</h2>
              </div>
              <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/60">
                {mode > 0.45 ? 'Simple' : mode < -0.45 ? 'Detailed' : 'Balanced'}
              </span>
            </div>
            <input
              aria-label="Response detail"
              type="range"
              min="-1"
              max="1"
              step="0.1"
              value={mode}
              onChange={(event) => setMode(Number(event.target.value))}
              className="w-full accent-saffron"
            />
            <div className="mt-3 flex justify-between text-xs font-bold uppercase tracking-[0.15em] text-white/42">
              <span>More detail</span>
              <span>More simple</span>
            </div>
            <p className="mt-8 max-w-xl font-display text-2xl leading-snug text-white/86">
              {mode > 0.45
                ? 'Warm, short explanations that are easy to share at home.'
                : mode < -0.45
                  ? 'Precise figures, percentages, and analytical context.'
                  : 'Clear numbers with enough context to make a decision.'}
            </p>
          </section>
        </div>

        <div className="mt-14 mb-6 flex items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Choose a starting point</p>
            <h2 className="mt-2 text-4xl font-bold tracking-[-0.04em]">Four ways into your finances.</h2>
          </div>
          <p className="hidden max-w-sm text-right text-sm leading-6 text-muted md:block">
            Each workflow is independent. Start with the information you already have.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {actions.map((action, index) => (
            <motion.div
              key={action.href}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.06 }}
            >
              <Link
                href={action.href}
                className={`group flex min-h-56 flex-col justify-between overflow-hidden rounded-[1.8rem] p-7 shadow-[0_22px_60px_rgba(70,45,20,0.1)] transition-transform hover:-translate-y-1 ${action.tone}`}
              >
                <div className="flex items-start justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl border border-current/15 bg-white/10">
                    <action.icon className="size-6" />
                  </span>
                  <ArrowUpRight className="size-6 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-60">{action.kicker}</p>
                  <h3 className="mt-2 text-3xl font-bold">{action.label}</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 opacity-72">{action.copy}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-14">
          <section className="paper-card rounded-[1.8rem] p-6 sm:p-8">
            <div className="mb-5">
              <p className="eyebrow">A calmer month</p>
              <h2 className="mt-2 text-2xl font-bold">Expense rhythm</h2>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid vertical={false} stroke="rgba(25,20,15,0.08)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} cursor={{ fill: 'rgba(242,179,61,0.1)' }} />
                <Bar dataKey="amount" fill="#b35d16" radius={[10, 10, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>
      </section>
    </main>
  );
}
