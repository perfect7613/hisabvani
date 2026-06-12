'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpenText, FileScan, Film, LayoutDashboard, Mic2, WalletCards } from 'lucide-react';

const navigation = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/expense', label: 'Voice khata', icon: WalletCards },
  { href: '/voice', label: 'Ask', icon: Mic2 },
  { href: '/upload', label: 'Scan bill', icon: FileScan },
  { href: '/video', label: 'Films', icon: Film },
];

export function ProductHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[0.9rem] bg-ink text-saffron shadow-[0_6px_20px_rgba(25,20,15,0.14)] transition-transform group-hover:-rotate-3">
            <BookOpenText className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-xl font-bold leading-none tracking-[-0.03em]">
              HisabVani
            </span>
            <span className="mt-1 hidden text-[0.64rem] font-bold uppercase tracking-[0.2em] text-muted sm:block">
              Ghar ka hisaab, clearly
            </span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="flex items-center gap-1 overflow-x-auto rounded-full border border-ink/10 bg-white/55 p-1">
          {navigation.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-colors sm:px-4 sm:text-sm ${
                  active
                    ? 'bg-ink text-cream'
                    : 'text-ink/60 hover:bg-white hover:text-ink'
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
