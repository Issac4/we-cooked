import { useState } from 'react';
import { Heart } from 'lucide-react';
import { MAX_RATING, type RatingSummary } from '@wecooked/shared';

const ONE_TO_FIVE = Array.from({ length: MAX_RATING }, (_, i) => i + 1);

/** Read-only hearts, rounded to the nearest half for averages. */
export function Hearts({ value, size = 14 }: { value: number; size?: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center gap-px align-[-2px]" role="img" aria-label={`${value} out of ${MAX_RATING} hearts`}>
      {ONE_TO_FIVE.map((n) => {
        const fill = rounded >= n ? 1 : rounded >= n - 0.5 ? 0.5 : 0;
        return (
          <span key={n} className="relative inline-flex" aria-hidden="true">
            <Heart size={size} className="text-line-strong" fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Heart size={size} className="text-heart" fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Tap a heart to rate; tap the same heart again to clear. */
export function HeartPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-2">
      <div role="radiogroup" aria-label="Your rating" className="flex" onMouseLeave={() => setHover(null)}>
        {ONE_TO_FIVE.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'heart' : 'hearts'}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(value === n ? null : n)}
            className="flex size-9 cursor-pointer items-center justify-center"
          >
            <Heart size={22} className={n <= shown ? 'text-heart' : 'text-line-strong'} fill="currentColor" strokeWidth={0} />
          </button>
        ))}
      </div>
      <span className="text-[13px] text-muted">{value ? `${value} of ${MAX_RATING}` : 'No rating (optional)'}</span>
    </div>
  );
}

/** "♥♥♥♥½ 4.3 · Bethany 5 · Dad 2 · Issac 5" on the recipe page. */
export function RatingLine({ rating }: { rating: RatingSummary }) {
  return (
    <a href="#notes-title" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-2 no-underline hover:text-ink">
      <Hearts value={rating.average} size={16} />
      <strong className="font-semibold text-ink">{rating.average.toFixed(1)}</strong>
      <span className="text-[13px] text-muted">
        {rating.people.map((p) => `${p.name} ${p.rating}`).join(' · ')}
      </span>
    </a>
  );
}
