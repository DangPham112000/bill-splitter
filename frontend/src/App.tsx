import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { AccountMenu } from './components/AccountMenu';
import { authEnabled } from './lib/auth';

const STATUS = gql`
  query Status {
    health {
      status
      database
    }
    me {
      clerkId
    }
  }
`;

type StatusData = {
  health: { status: string; database: string };
  me: { clerkId: string } | null;
};

export default function App() {
  const { data, loading, error } = useQuery<StatusData>(STATUS);

  const serverStatus = loading
    ? 'Checking server…'
    : error
      ? 'Server unreachable'
      : `Server ${data?.health.status}, database ${data?.health.database}`;

  return (
    <>
      {authEnabled && (
        <header className="flex justify-end p-4">
          <AccountMenu />
        </header>
      )}
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-3xl font-semibold">Bill Splitter</h1>
        <p className="text-slate-600">Split trip and party expenses with the fewest transfers.</p>
        <p className="text-sm text-slate-400">{serverStatus}</p>
        {data && (
          <p className="text-sm text-slate-400">
            {data.me ? 'Signed in: the server recognizes your account' : 'Not signed in'}
          </p>
        )}
      </main>
    </>
  );
}
