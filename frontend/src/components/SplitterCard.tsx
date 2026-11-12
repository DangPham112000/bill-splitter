import { Link } from 'react-router';
import {
  DEFAULT_EMOJI,
  SPLITTER_TYPE_LABELS,
  formatDateRange,
  type Splitter,
} from '../graphql/splitters';
import { EmojiTile } from './ui';

export function SplitterCard({ splitter }: { splitter: Splitter }) {
  const dates = formatDateRange(splitter.startDate, splitter.endDate);
  return (
    <Link
      to={`/s/${splitter.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
    >
      <EmojiTile emoji={splitter.coverEmoji || DEFAULT_EMOJI[splitter.type]} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{splitter.name}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {[
            splitter.me && !splitter.isAdmin ? `as ${splitter.me.displayName}` : null,
            SPLITTER_TYPE_LABELS[splitter.type],
            dates,
            `${splitter.members.length} members`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      {splitter.status === 'locked' && (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Locked
        </span>
      )}
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden>
        <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </Link>
  );
}
