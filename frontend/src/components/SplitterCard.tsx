import { Link } from 'react-router';
import {
  DEFAULT_EMOJI,
  SPLITTER_TYPE_LABELS,
  formatDateRange,
  type Splitter,
} from '../graphql/splitters';

export function SplitterCard({ splitter }: { splitter: Splitter }) {
  const dates = formatDateRange(splitter.startDate, splitter.endDate);
  return (
    <Link
      to={`/s/${splitter.id}`}
      className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl">
        {splitter.coverEmoji || DEFAULT_EMOJI[splitter.type]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{splitter.name}</span>
        <span className="block text-sm text-slate-500">
          {[SPLITTER_TYPE_LABELS[splitter.type], dates, `${splitter.members.length} members`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </Link>
  );
}
