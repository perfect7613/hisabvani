import { CloudSun, LoaderCircle } from 'lucide-react';

export function ServiceNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-saffron/20 bg-saffron/8 text-ink/70 ${compact ? 'p-3 text-xs' : 'p-4 text-sm'}`}>
      <CloudSun className="mt-0.5 size-4 shrink-0 text-copper" />
      <p className="leading-5">
        The free Render service may take about a minute to wake after being idle. Keep this page open while it prepares your request.
      </p>
    </div>
  );
}

export function WorkingState({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </span>
  );
}
