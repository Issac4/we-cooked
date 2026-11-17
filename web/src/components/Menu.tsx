import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** A "⋯" button with a small list of actions. Closes on outside click or Escape. */
export function Menu({ label, items, align = 'left', trigger }: { label: string; items: MenuItem[]; align?: 'left' | 'right'; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onPointerDown={(e) => e.stopPropagation()}
        className={`flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-line hover:text-ink ${open ? 'bg-line text-ink' : ''}`}
      >
        {trigger ?? <MoreHorizontal size={16} aria-hidden="true" />}
      </button>
      {open && (
        <div role="menu" className={`absolute top-full z-30 mt-1 flex w-48 flex-col rounded-xl border border-line-strong bg-surface p-1 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`cursor-pointer rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-sidebar disabled:cursor-default disabled:opacity-40 ${item.danger ? 'text-danger' : 'text-ink'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
