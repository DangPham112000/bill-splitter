import type { ReactNode } from 'react';
import { cardClass } from '../lib/styles';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${cardClass} ${className}`}>{children}</div>;
}

/** Small uppercase heading above a group of rows, like a settings list. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

// Soft backgrounds for initials; picked from the name so a person keeps their color.
const AVATAR_HUES = [45, 155, 250, 300, 200, 20, 120, 330];

function hueFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) | 0;
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

/** Round avatar with the first letter of the name. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const hue = hueFor(name);
  const sizes = { sm: 'h-8 w-8 text-sm', md: 'h-10 w-10 text-base', lg: 'h-12 w-12 text-lg' };
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]}`}
      style={{
        background: `oklch(0.75 0.11 ${hue} / 0.25)`,
        color: `oklch(0.6 0.15 ${hue})`,
      }}
    >
      {[...name.trim()][0]?.toUpperCase() ?? '?'}
    </span>
  );
}

/** Emoji tile used for a splitter's cover. */
export function EmojiTile({ emoji, size = 'md' }: { emoji: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-10 w-10 rounded-xl text-xl',
    md: 'h-12 w-12 rounded-xl text-2xl',
    lg: 'h-16 w-16 rounded-2xl text-4xl',
  };
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-primary-soft ${sizes[size]}`}
    >
      {emoji}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl">
        {icon}
      </span>
      <h3 className="font-semibold">{title}</h3>
      {children && <p className="max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {label}
    </div>
  );
}

/** Simple line icons, so the app needs no icon library. */
export function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name: 'plus' | 'back' | 'edit' | 'share' | 'users' | 'receipt' | 'scale' | 'external' | 'device';
  className?: string;
}) {
  const paths: Record<typeof name, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    back: <path d="M15 18l-6-6 6-6" />,
    edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
    share: (
      <>
        <path d="M12 3v12M7 8l5-5 5 5" />
        <path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
    scale: (
      <>
        <path d="M12 4v16M5 20h14M4 8h16" />
        <path d="M7 8l-3 6a3 3 0 006 0L7 8zM17 8l-3 6a3 3 0 006 0l-3-6z" />
      </>
    ),
    external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />,
    device: (
      <>
        <rect x="7" y="2.5" width="10" height="19" rx="2" />
        <path d="M11 18.5h2" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
