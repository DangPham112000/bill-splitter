/**
 * Shared look for buttons, inputs and cards: "liquid glass" capsules and panes (see the glass
 * utilities in index.css). Colors come from the theme tokens there.
 */
export const btn = {
  primary:
    'glass-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 font-medium text-primary-foreground transition-[filter,transform] hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
  secondary:
    'glass inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 font-medium transition-[background-color,transform] hover:bg-card active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50',
  small:
    'glass inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-sm transition-colors hover:bg-card disabled:opacity-50',
  icon: 'inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
};

export const inputClass =
  'w-full rounded-xl border border-input bg-card px-3 py-2.5 text-foreground outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-60';

export const cardClass = 'glass rounded-3xl text-card-foreground';
