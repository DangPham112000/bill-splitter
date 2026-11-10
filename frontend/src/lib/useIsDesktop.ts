import { useSyncExternalStore } from 'react';

// Tailwind's lg breakpoint: from here the app shows its sidebar and two-column pages.
const QUERY = '(min-width: 1024px)';

const subscribe = (onChange: () => void) => {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
};

/** True on a wide screen. Used where a part must be rendered once, not just hidden by CSS. */
export function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
