/** Shared look for buttons, inputs and cards. Colors come from the theme tokens in index.css. */
export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-medium transition-colors hover:bg-muted disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50',
  small:
    'inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-sm transition-colors hover:bg-muted disabled:opacity-50',
  icon: 'inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
};

export const inputClass =
  'w-full rounded-xl border border-input bg-card px-3 py-2.5 text-foreground outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-60';

export const cardClass = 'rounded-2xl border border-border bg-card text-card-foreground';
