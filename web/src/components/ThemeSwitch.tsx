import { Monitor, Moon, Sun } from 'lucide-react';
import { setTheme, useTheme, type ThemeChoice } from '../lib/theme';

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'auto', label: 'Auto', Icon: Monitor },
];

/** Light · Dark · Auto, remembered by this browser only. */
export function ThemeSwitch({ className = '' }: { className?: string }) {
  const choice = useTheme();
  return (
    <div role="group" aria-label="Colour mode" className={`flex rounded-xl bg-line/60 p-[3px] ${className}`}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={choice === value}
          title={value === 'auto' ? 'Follow this device’s setting' : undefined}
          onClick={() => setTheme(value)}
          className={`flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] text-[13px] font-semibold ${
            choice === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          <Icon size={14} aria-hidden="true" /> {label}
        </button>
      ))}
    </div>
  );
}
