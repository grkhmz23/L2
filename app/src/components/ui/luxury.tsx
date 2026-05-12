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
      {/* Outer shield / vault badge */}
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="12"
        fill="url(#sable-bg)"
        stroke="url(#sable-border)"
        strokeWidth="1"
      />

      {/* Inner bevel highlight */}
      <rect
        x="4.5"
        y="4.5"
        width="39"
        height="39"
        rx="10.5"
        stroke="url(#sable-inner-glow)"
        strokeWidth="0.5"
        opacity="0.6"
      />

      {/* Top arc of S — ivory/cream ribbon */}
      <path
        d="M14 18.5C14 14.5 17.5 12 24 12C30.5 12 34 14.2 34 17.5C34 20.5 31 22 26 22.5C21 23 18 24 18 27C18 29.5 20.5 31 24 31"
        stroke="url(#sable-ribbon-top)"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Bottom arc of S — gold ribbon */}
      <path
        d="M34 29.5C34 33.5 30.5 36 24 36C17.5 36 14 33.8 14 30.5C14 27.5 17 26 22 25.5C27 25 30 24 30 21C30 18.5 27.5 17 24 17"
        stroke="url(#sable-ribbon-bottom)"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Center diamond / vault seal accent */}
      <path
        d="M24 15.5L26.5 20.5L24 22L21.5 20.5Z"
        fill="url(#sable-diamond)"
        opacity="0.9"
      />
      <path
        d="M24 32.5L21.5 27.5L24 26L26.5 27.5Z"
        fill="url(#sable-diamond)"
        opacity="0.9"
      />

      {/* Tiny seal dot */}
      <circle cx="24" cy="24" r="1.2" fill="#FCF6BA" opacity="0.85" />

      <defs>
        {/* Background gradient — deep graphite */}
        <radialGradient id="sable-bg" cx="24" cy="24" r="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e1c1a" />
          <stop offset="60%" stopColor="#12100e" />
          <stop offset="100%" stopColor="#0a0908" />
        </radialGradient>

        {/* Border gradient — warm metallic gold */}
        <linearGradient id="sable-border" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8C6B22" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#FCF6BA" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8C6B22" stopOpacity="0.6" />
        </linearGradient>

        {/* Inner glow — subtle amber halo */}
        <linearGradient id="sable-inner-glow" x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCF6BA" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#BF953F" stopOpacity="0.05" />
        </linearGradient>

        {/* Top ribbon — ivory to pale gold */}
        <linearGradient id="sable-ribbon-top" x1="14" y1="12" x2="34" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F8F1D2" />
          <stop offset="55%" stopColor="#FCF6BA" />
          <stop offset="100%" stopColor="#D4B87A" />
        </linearGradient>

        {/* Bottom ribbon — rich gold to deep amber */}
        <linearGradient id="sable-ribbon-bottom" x1="34" y1="36" x2="14" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B38728" />
          <stop offset="45%" stopColor="#BF953F" />
          <stop offset="100%" stopColor="#FCF6BA" />
        </linearGradient>

        {/* Diamond accent — bright gold */}
        <linearGradient id="sable-diamond" x1="21" y1="15" x2="27" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCF6BA" />
          <stop offset="100%" stopColor="#BF953F" />
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
