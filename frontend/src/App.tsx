import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

const HEALTH = gql`
  query Health {
    health {
      status
      database
    }
  }
`;

type HealthData = { health: { status: string; database: string } };

export default function App() {
  const { data, loading, error } = useQuery<HealthData>(HEALTH);

  const serverStatus = loading
    ? 'Checking server…'
    : error
      ? 'Server unreachable'
      : `Server ${data?.health.status}, database ${data?.health.database}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-semibold">Bill Splitter</h1>
      <p className="text-slate-600">Split trip and party expenses with the fewest transfers.</p>
      <p className="text-sm text-slate-400">{serverStatus}</p>
    </main>
  );
}
