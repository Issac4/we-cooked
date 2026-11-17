import { useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useRecipeFilters, useTagGroups } from '../lib/recipes';

export function Pill({ active, children, onClick, large = false }: { active: boolean; children: React.ReactNode; onClick: () => void; large?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`cursor-pointer rounded-full border font-medium transition ${large ? 'h-10 px-3.5 text-sm' : 'px-[13px] py-[7px] text-[13px] leading-[18px]'} ${
        active ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface text-ink-2 hover:border-muted'
      }`}
    >
      {children}
    </button>
  );
}

/** The pill groups (Protein, Meal, Cuisine, ...). */
export function FilterGroups({ large = false }: { large?: boolean }) {
  const groups = useTagGroups();
  const { tags, toggleTag } = useRecipeFilters();
  if (groups.isPending) {
    return (
      <div className="flex flex-wrap gap-1.5" aria-hidden="true">
        {[60, 48, 72, 56].map((w) => (
          <span key={w} className="h-8 animate-pulse rounded-full bg-line" style={{ width: w }} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-[18px]">
      {groups.data?.map((g) =>
        g.tags.length ? (
          <div key={g.id} className="flex flex-col gap-2">
            <h3 className="px-1 text-[13px] font-semibold text-ink-2">{g.name}</h3>
            <div className="flex flex-wrap gap-1.5">
              {g.tags.map((t) => (
                <Pill key={t.id} active={tags.includes(t.id)} onClick={() => toggleTag(t.id)} large={large}>
                  {t.name}
                </Pill>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

/** Sidebar block: heading, "Clear all", then the groups. */
export function SidebarFilters() {
  const { tags, clear } = useRecipeFilters();
  return (
    <section className="flex flex-col gap-[18px]">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">Filters</h2>
        {tags.length > 0 && (
          <button type="button" onClick={clear} className="cursor-pointer px-1.5 py-1 text-xs font-semibold text-accent">
            Clear all
          </button>
        )}
      </div>
      <FilterGroups />
    </section>
  );
}

/** Phone: a "Filters" button that opens the pill groups in a bottom sheet. */
export function FilterSheet({ open, onClose, resultLabel }: { open: boolean; onClose: () => void; resultLabel: string }) {
  const { clear } = useRecipeFilters();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-[rgba(31,27,22,0.36)] md:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filters-title"
        className="flex max-h-[80vh] w-full flex-col gap-4 overflow-y-auto rounded-t-[22px] bg-surface px-4 pt-2.5 pb-[max(20px,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="h-1 w-10 self-center rounded-sm bg-line-strong" />
        <div className="flex items-center justify-between">
          <h2 id="filters-title" className="text-lg font-bold">
            Filters
          </h2>
          <button type="button" onClick={clear} className="h-10 cursor-pointer px-2 font-semibold text-accent">
            Clear all
          </button>
        </div>
        <FilterGroups large />
        <button type="button" onClick={onClose} className="h-12 cursor-pointer rounded-xl bg-accent font-semibold text-white">
          Show {resultLabel}
        </button>
      </div>
    </div>
  );
}

export function FiltersButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-3.5 font-semibold text-page md:hidden">
      <SlidersHorizontal size={15} aria-hidden="true" />
      {count ? `Filters · ${count}` : 'Filters'}
    </button>
  );
}

/** Removable chips for the active filters. */
export function ActiveFilterChips() {
  const groups = useTagGroups();
  const { tags, toggleTag } = useRecipeFilters();
  const all = groups.data?.flatMap((g) => g.tags) ?? [];
  return (
    <>
      {tags.map((id) => {
        const tag = all.find((t) => t.id === id);
        if (!tag) return null;
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggleTag(id)}
            aria-label={`Remove filter ${tag.name}`}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-accent-soft pr-2.5 pl-3.5 text-[13px] font-medium text-accent-ink md:h-auto md:py-[5px]"
          >
            {tag.name}
            <X size={14} aria-hidden="true" />
          </button>
        );
      })}
    </>
  );
}
