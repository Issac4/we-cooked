import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Modal built on the native <dialog>: the browser handles focus trapping,
 * Escape to close and hiding the rest of the page from screen readers.
 */
export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      aria-labelledby="dialog-title"
      className={`m-auto w-[calc(100%-32px)] rounded-[18px] bg-surface p-0 text-ink shadow-[0_20px_48px_rgba(31,27,22,0.22)] backdrop:bg-[rgba(31,27,22,0.32)] ${wide ? 'max-w-[560px]' : 'max-w-[460px]'}`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 id="dialog-title" className="text-lg font-bold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] bg-sidebar">
              <X size={16} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
