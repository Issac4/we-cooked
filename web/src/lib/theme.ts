import { useSyncExternalStore } from 'react';

/**
 * Light / Dark / Auto, chosen per browser (a phone can be dark while the PC is light).
 * index.html runs the same logic inline before the first paint so the page never flashes;
 * keep THEME_KEY and the colours below in sync with it.
 */
export type ThemeChoice = 'light' | 'dark' | 'auto';

export const THEME_KEY = 'wc-theme';
const BAR_COLOUR = { light: '#faf8f4', dark: '#171512' } as const;
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)');

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function apply(choice: ThemeChoice) {
  const mode = choice === 'auto' ? (systemDark().matches ? 'dark' : 'light') : choice;
  document.documentElement.dataset.theme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOUR[mode]);
}

const listeners = new Set<() => void>();
let current: ThemeChoice = typeof window === 'undefined' ? 'auto' : read();

export function setTheme(choice: ThemeChoice) {
  current = choice;
  try {
    if (choice === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice still applies until the page is closed.
  }
  apply(choice);
  listeners.forEach((l) => l());
}

/** Call once at start-up: follows the system while on Auto, and other tabs' changes. */
export function initTheme() {
  apply(current);
  systemDark().addEventListener('change', () => current === 'auto' && apply('auto'));
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY) {
      current = read();
      apply(current);
      listeners.forEach((l) => l());
    }
  });
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
  );
}
