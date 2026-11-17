import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-110',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-sidebar',
  ghost: 'text-ink-2 hover:bg-sidebar',
  danger: 'border border-line-strong bg-surface text-danger hover:bg-sidebar',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  busy = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; busy?: boolean }) {
  const sizing = size === 'sm' ? 'h-9 px-3 text-[13px] rounded-[9px]' : 'h-11 px-[18px] rounded-xl';
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${sizing} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  error,
  hint,
  type = 'text',
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          {...props}
          className={`h-11 w-full rounded-[10px] border bg-surface px-3 text-ink placeholder:text-muted ${
            error ? 'border-danger' : 'border-line-strong'
          } ${isPassword ? 'pr-11' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute top-0 right-0 flex h-11 w-11 cursor-pointer items-center justify-center text-muted hover:text-ink"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>{children}</section>;
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const tones = {
    error: 'border-danger/40 text-danger',
    success: 'border-transparent bg-accent-soft text-accent-ink',
    info: 'border-line bg-surface text-ink-2',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-[10px] bg-accent text-white"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11h18" />
        <path d="M5 11v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6" />
        <path d="M9 7c0-1 .5-2 1-2.5" />
        <path d="M14 7c0-1 .5-2 1-2.5" />
      </svg>
    </span>
  );
}

export function formatDate(ms: number, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-GB', opts).format(ms);
}

/** "Today", "Yesterday", "3 days ago" or a date. */
export function relativeDay(ms: number | null): string {
  if (!ms) return 'Never';
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - ms) / 86_400_000) + 1;
  if (ms >= startOfToday.getTime()) return 'Today';
  if (days <= 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(ms);
}
