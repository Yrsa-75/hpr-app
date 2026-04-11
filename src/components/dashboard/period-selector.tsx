'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const PERIODS = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: 'all', label: 'Total' },
] as const;

interface PeriodSelectorProps {
  current: string;
}

export function PeriodSelector({ current }: PeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => handleChange(p.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            current === p.value
              ? 'bg-hpr-gold/15 text-hpr-gold'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
