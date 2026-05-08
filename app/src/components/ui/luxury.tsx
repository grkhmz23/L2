'use client';

import * as React from 'react';

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function truncateAddress(value: string, head = 8, tail = 8) {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

interface SableMarkProps {
  className?: string;
  size?: number;
}

export function SableMark({ className, size = 36 }: SableMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Sable"
      className={cn('shrink-0', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="4"
        y="4"
        width="40"
        height="40"
        rx="10"
        fill="url(#sable-mark-bg)"
        stroke="url(#sable-mark-stroke)"
      />
      <path
        d="M32.5 14.4C29.4 12.6 24.9 12 21.4 13.2C17.8 14.4 15.8 16.8 16 19.4C16.3 22.7 19.7 23.7 24.2 24.4C28.1 25 30 25.7 30.1 27.6C30.2 29.4 28.6 30.8 25.8 31.3C22.3 31.9 18.4 30.9 15.4 28.8"
        stroke="#F8F1D2"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M15.5 34.2C19.1 36.5 25.3 37.1 29.8 35.4C34.1 33.8 36.3 30.9 36 27.4C35.7 23.2 32 21.4 25.4 20.4C22.2 19.9 21 19.4 20.9 18.3C20.8 17.1 22 16.3 24 16C26.3 15.7 29 16.2 31.5 17.5"
        stroke="url(#sable-mark-gold)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="35" cy="13" r="2" fill="#FCF6BA" opacity="0.85" />
      <defs>
        <linearGradient id="sable-mark-bg" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#191816" />
          <stop offset="1" stopColor="#050505" />
        </linearGradient>
        <linearGradient id="sable-mark-stroke" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCF6BA" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8C6B22" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="sable-mark-gold" x1="14" y1="18" x2="37" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#BF953F" />
          <stop offset="0.52" stopColor="#FCF6BA" />
          <stop offset="1" stopColor="#B38728" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SableLogo({ className }: { className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <SableMark />
      <div className="min-w-0">
        <h1 className="truncate text-base text-white">Sable</h1>
        <p className="truncate text-[9px] uppercase tracking-[0.25em] text-zinc-500">
          Agent Treasury
        </p>
      </div>
    </div>
  );
}

export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex h-7 shrink-0 items-center rounded-md border border-white/10 bg-white/[0.03] px-2 text-[10px] uppercase tracking-[0.12em] text-zinc-400 transition hover:border-amber-200/25 hover:text-amber-100',
        className
      )}
      title={label}
      aria-label={label}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function CopyableAddress({
  value,
  label = 'Copy address',
  head = 10,
  tail = 8,
  className,
}: {
  value: string;
  label?: string;
  head?: number;
  tail?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5',
        className
      )}
    >
      <span className="min-w-0 truncate font-mono text-xs text-zinc-300">
        {truncateAddress(value, head, tail)}
      </span>
      <CopyButton value={value} label={label} />
    </span>
  );
}

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
}

export function GlassPanel({ children, className, highlight = false }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'relative min-w-0 overflow-hidden rounded-xl border backdrop-blur-2xl',
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]',
        highlight
          ? 'border-[rgba(214,190,112,0.25)] shadow-[0_12px_60px_rgba(191,149,63,0.10)]'
          : 'border-white/8 shadow-[0_16px_60px_rgba(0,0,0,0.35)]',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(252,246,186,0.06),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent_55%)]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface LuxuryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function LuxuryButton({
  children,
  className,
  variant = 'primary',
  isLoading = false,
  disabled,
  fullWidth = false,
  leading,
  trailing,
  ...props
}: LuxuryButtonProps) {
  const base =
    'group relative inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-md px-5 py-3 text-center text-xs font-medium uppercase leading-none tracking-[0.14em] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-45';
  const styles: Record<ButtonVariant, string> = {
    primary:
      'text-black bg-[linear-gradient(90deg,#BF953F_0%,#FCF6BA_50%,#B38728_100%)] shadow-[0_0_30px_rgba(191,149,63,0.22)] hover:scale-[1.01] hover:shadow-[0_0_42px_rgba(191,149,63,0.35)]',
    secondary:
      'text-zinc-100 border border-white/12 bg-white/5 hover:bg-white/9 hover:border-white/20',
    ghost:
      'text-zinc-400 hover:text-zinc-100 hover:bg-white/5',
    danger:
      'text-rose-100 border border-rose-400/20 bg-rose-500/10 hover:bg-rose-500/15',
  };

  return (
    <button
      className={cn(base, styles[variant], fullWidth && 'w-full', className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Spinner className="h-3.5 w-3.5" /> : leading}
      <span className="min-w-0 truncate">{children}</span>
      {!isLoading ? trailing : null}
      {variant === 'primary' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 [mask-image:linear-gradient(120deg,transparent_0%,white_50%,transparent_100%)] bg-white/45 transition-opacity duration-500 group-hover:opacity-100"
        />
      ) : null}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-r-transparent',
        className
      )}
      aria-hidden
    />
  );
}

interface FieldLabelProps {
  children: React.ReactNode;
  hint?: React.ReactNode;
}

export function FieldLabel({ children, hint }: FieldLabelProps) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <label className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        {children}
      </label>
      {hint ? <span className="text-[10px] text-zinc-600">{hint}</span> : null}
    </div>
  );
}

type BaseFieldProps = {
  className?: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
};

export function LuxuryInput({
  className,
  label,
  hint,
  error,
  ...props
}: BaseFieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      {label ? <FieldLabel hint={hint}>{label}</FieldLabel> : null}
      <input
        className={cn(
          'w-full min-w-0 rounded-lg border bg-white/[0.02] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600',
          'border-white/10 focus:border-[rgba(214,190,112,0.32)] focus:bg-white/[0.04] focus:outline-none',
          'font-sans transition-colors',
          error && 'border-rose-400/35',
          className
        )}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

export function LuxuryTextarea({
  className,
  label,
  hint,
  error,
  ...props
}: BaseFieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      {label ? <FieldLabel hint={hint}>{label}</FieldLabel> : null}
      <textarea
        className={cn(
          'w-full min-w-0 rounded-lg border bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600',
          'border-white/10 focus:border-[rgba(214,190,112,0.32)] focus:bg-white/[0.04] focus:outline-none',
          'font-mono transition-colors resize-y',
          error && 'border-rose-400/35',
          className
        )}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

interface PillProps {
  children: React.ReactNode;
  tone?: 'default' | 'amber' | 'green' | 'red';
  className?: string;
}

export function Pill({ children, tone = 'default', className }: PillProps) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-zinc-300',
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    green: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    red: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
  };
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em]',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

interface TimelineItemProps {
  label: string;
  active?: boolean;
  done?: boolean;
  warning?: boolean;
  last?: boolean;
}

export function TimelineItem({
  label,
  active = false,
  done = false,
  warning = false,
  last = false,
}: TimelineItemProps) {
  return (
    <div className="relative flex items-center gap-3 pl-1">
      {!last ? (
        <span
          aria-hidden
          className={cn(
            'absolute left-[8px] top-5 h-[22px] w-px',
            done ? 'bg-amber-200/30' : 'bg-white/8'
          )}
        />
      ) : null}
      <span
        aria-hidden
        className={cn(
          'relative z-10 grid h-4 w-4 place-items-center rounded-full border bg-black',
          done && 'border-amber-200/45',
          active && !warning && 'border-amber-300 shadow-[0_0_14px_rgba(252,246,186,0.35)]',
          active && warning && 'border-rose-300 shadow-[0_0_14px_rgba(251,113,133,0.28)]',
          !active && !done && 'border-white/12'
        )}
      >
        {done ? (
          <span className="h-1.5 w-1.5 rounded-full bg-amber-100" />
        ) : active ? (
          <span
            className={cn(
              'h-1.5 w-1.5 animate-pulse rounded-full',
              warning ? 'bg-rose-300' : 'bg-amber-100'
            )}
          />
        ) : null}
      </span>
      <span
        className={cn(
          'text-xs',
          active ? (warning ? 'text-rose-100' : 'text-amber-100') : done ? 'text-zinc-300' : 'text-zinc-600'
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[10px] uppercase tracking-[0.26em] text-zinc-500">{eyebrow}</p>
        ) : null}
        <h2 className="text-xl leading-tight text-white md:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
