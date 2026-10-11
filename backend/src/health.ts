import mongoose from 'mongoose';

export type Health = {
  status: 'ok' | 'degraded';
  database: 'connected' | 'disconnected';
  time: string;
};

// "degraded" means the server is up but cannot reach MongoDB.
export function getHealth(): Health {
  const connected = mongoose.connection.readyState === mongoose.ConnectionStates.connected;
  return {
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  };
}
