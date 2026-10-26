import { Link } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { MY_SPLITTERS, type Splitter } from '../graphql/splitters';
import { SplitterCard } from '../components/SplitterCard';
import { useAuthState } from '../lib/useAuthState';

export function HomePage() {
  const { isSignedIn } = useAuthState();
  const { data, loading } = useQuery<{ mySplitters: Splitter[] }>(MY_SPLITTERS, {
    skip: !isSignedIn,
  });

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Split costs with your group</h1>
        <p className="mt-2 text-slate-600">
          For a trip, a party or a project: everyone adds what they paid, and the app works out who
          pays whom with the fewest transfers.
        </p>
      </div>

      <Link
        to="/new"
        className="rounded-lg bg-sky-600 px-4 py-3 text-center font-medium text-white hover:bg-sky-700"
      >
        Create a splitter
      </Link>

      {isSignedIn && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-slate-500">My splitters</h2>
          {loading && <p className="text-sm text-slate-400">Loading…</p>}
          {data?.mySplitters.length === 0 && (
            <p className="text-sm text-slate-400">You have not created a splitter yet.</p>
          )}
          {data?.mySplitters.map((splitter) => (
            <SplitterCard key={splitter.id} splitter={splitter} />
          ))}
        </section>
      )}
    </div>
  );
}
