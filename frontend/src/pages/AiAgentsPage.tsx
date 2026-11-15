import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { CREATE_API_KEY, GET_API_KEYS, REVOKE_API_KEY, type ApiKey } from '../graphql/apiKeys';
import { SignInPrompt } from '../components/SignInPrompt';
import { Card, Icon, Loading, SectionTitle } from '../components/ui';
import { btn, inputClass } from '../lib/styles';
import { useAuthState } from '../lib/useAuthState';

// Production serves /mcp on the app's own origin; Vite proxies it in dev.
const mcpUrl = `${window.location.origin}/mcp`;

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <button
          type="button"
          className={btn.small}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied && <Icon name="check" className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-2xl bg-muted p-3 text-xs leading-relaxed whitespace-pre">
        {text}
      </pre>
    </div>
  );
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'never');

function KeyRow({ apiKey }: { apiKey: ApiKey }) {
  const [confirming, setConfirming] = useState(false);
  const [revoke, { loading }] = useMutation(REVOKE_API_KEY, {
    refetchQueries: [{ query: GET_API_KEYS }],
  });
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{apiKey.name}</p>
        <p className="text-xs text-muted-foreground">
          {apiKey.prefix}… · created {when(apiKey.createdAt)} · last used {when(apiKey.lastUsedAt)}
        </p>
      </div>
      {confirming ? (
        <div className="flex shrink-0 gap-1">
          <button type="button" className={btn.ghost} onClick={() => setConfirming(false)}>
            Keep
          </button>
          <button
            type="button"
            className={`${btn.small} text-destructive`}
            disabled={loading}
            onClick={() => revoke({ variables: { id: apiKey.id } })}
          >
            {loading ? 'Revoking…' : 'Revoke'}
          </button>
        </div>
      ) : (
        <button type="button" className={btn.ghost} onClick={() => setConfirming(true)}>
          Revoke
        </button>
      )}
    </li>
  );
}

/**
 * /agents (DAN-125): connect an AI assistant to Bill Splitter's MCP server, by signing in from
 * the assistant (claude.ai, ChatGPT, Gemini) or with a personal API key for bots and scripts.
 */
export function AiAgentsPage() {
  const { isLoaded, isSignedIn } = useAuthState();
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, loading } = useQuery<{ apiKeys: ApiKey[] }>(GET_API_KEYS, { skip: !isSignedIn });
  const [createKey, { loading: creating }] = useMutation<{
    createApiKey: { key: string };
  }>(CREATE_API_KEY, { refetchQueries: [{ query: GET_API_KEYS }] });

  if (!isLoaded) return <Loading />;
  if (!isSignedIn) {
    return <SignInPrompt message="Sign in to connect an AI assistant to your splitters." />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const result = await createKey({ variables: { name: name.trim() || 'AI agent' } });
      setNewKey(result.data?.createApiKey.key ?? null);
      setName('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const key = newKey ?? '<YOUR_API_KEY>';
  const claudeCode = `claude mcp add --transport http bill-splitter ${mcpUrl} \\\n  --header "Authorization: Bearer ${key}"`;
  const jsonConfig = JSON.stringify(
    {
      mcpServers: { 'bill-splitter': { url: mcpUrl, headers: { Authorization: `Bearer ${key}` } } },
    },
    null,
    2,
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI agents</h1>
        <p className="text-muted-foreground">
          Let your assistant add expenses for you. Then just say: “thêm chi tiêu ăn tối 300k”, “who
          still owes me in the Đà Lạt trip?”, “split the taxi 450k between me and Lan”.
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-semibold">Easiest: sign in from your assistant</h2>
        <p className="text-sm text-muted-foreground">
          In claude.ai, ChatGPT, Gemini or Claude Desktop, add a custom connector with this URL.
          When it asks, sign in with your account and allow access. No key needed.
        </p>
        <CopyBlock label="MCP server URL" text={mcpUrl} />
      </Card>

      <SectionTitle>For bots and scripts: an API key</SectionTitle>
      <Card className="flex flex-col gap-4 p-5">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="key-name" className="text-sm font-medium">
            1. Create a key
          </label>
          <div className="flex gap-2">
            <input
              id="key-name"
              className={inputClass}
              placeholder="Name, e.g. Claude Code"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className={`${btn.primary} shrink-0`} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        {newKey && (
          <div className="flex flex-col gap-2 rounded-2xl border border-primary/40 p-3">
            <p className="text-sm font-medium">Copy this key now. It will not be shown again.</p>
            <CopyBlock label="API key" text={newKey} />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">2. Add the server to your agent</p>
          <CopyBlock label="Claude Code" text={claudeCode} />
          <CopyBlock label="Cursor, VS Code and other JSON configs" text={jsonConfig} />
          <CopyBlock label="Clients that only take a URL" text={`${mcpUrl}?key=${key}`} />
          <p className="text-xs text-muted-foreground">
            The URL-only form puts the key in the address, where it can end up in logs. Prefer the
            header form, and revoke keys you no longer use.
          </p>
        </div>
      </Card>

      <SectionTitle>Your keys</SectionTitle>
      {loading ? (
        <Loading />
      ) : !data?.apiKeys.length ? (
        <p className="px-1 text-sm text-muted-foreground">No keys yet.</p>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-glass-border">
            {data.apiKeys.map((k) => (
              <KeyRow key={k.id} apiKey={k} />
            ))}
          </ul>
        </Card>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        The assistant acts as you, in the splitters linked to your account. Expenses it adds show
        “AI agent” as the device they were added on, and only it (or the admin and treasurers) can
        change them.
      </p>
    </div>
  );
}
