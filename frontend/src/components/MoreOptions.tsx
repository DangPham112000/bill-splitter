import { Fragment, type ReactNode } from 'react';
import { Switch } from './ui';

/** One value in the read-only line. `field` is the id of the field it opens; none for fixed values. */
export type DefaultItem = { key: string; label: ReactNode; field?: string; hint?: string };

type ToggleProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The values saved while the options are hidden. */
  items: DefaultItem[];
  onPick: (field: string) => void;
  className?: string;
};

/** The "More options" switch, with the line of values that will be saved while it is off. */
export function MoreOptionsToggle({
  open,
  onOpenChange,
  items,
  onPick,
  className = '',
}: ToggleProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground/90">More options</span>
        <Switch label="More options" checked={open} onChange={onOpenChange} />
      </div>
      {!open && items.length > 0 && (
        <p className="text-sm leading-relaxed text-muted-foreground" aria-label="Will be saved as">
          {items.map((item, i) => (
            <Fragment key={item.key}>
              {i > 0 && (
                <span aria-hidden className="mx-1.5 text-muted-foreground/60">
                  ·
                </span>
              )}
              {item.field ? (
                <button
                  type="button"
                  onClick={() => onPick(item.field!)}
                  aria-label={item.hint}
                  className="rounded underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  {item.label}
                </button>
              ) : (
                <span>{item.label}</span>
              )}
            </Fragment>
          ))}
        </p>
      )}
    </div>
  );
}
