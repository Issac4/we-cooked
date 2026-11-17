import { photoUrl } from '@wecooked/shared';
import { tintFor } from '../lib/recipes';

function PotIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11h18" />
      <path d="M5 11v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6" />
      <path d="M9 7c0-1 .5-2 1-2.5" />
      <path d="M14 7c0-1 .5-2 1-2.5" />
    </svg>
  );
}

/** Cover photo, or a warm placeholder with a pot when there is none. */
export function RecipePhoto({
  id,
  photo,
  size = 'thumb',
  className = '',
  iconSize = 40,
}: {
  id: number;
  photo: string | null;
  size?: 'thumb' | 'full';
  className?: string;
  iconSize?: number;
}) {
  if (photo) {
    return <img src={photoUrl(photo, size)} alt="" loading="lazy" className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center text-[#8A7F6E] ${className}`} style={{ background: tintFor(id) }}>
      <PotIcon size={iconSize} />
    </div>
  );
}
