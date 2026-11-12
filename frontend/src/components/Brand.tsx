import { Link } from 'react-router';

/** App name with a small mark: a circle split in two, for "splitting" a bill. */
export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="flex h-8 w-8 items-center justify-center glass-primary rounded-xl text-primary-foreground">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="2" />
          <path d="M12 4.5v15" stroke="currentColor" strokeWidth="2" />
          <path d="M12 4.5a7.5 7.5 0 010 15z" fill="currentColor" />
        </svg>
      </span>
      <span className="text-lg">Bill Splitter</span>
    </Link>
  );
}
