import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiKey, ApiKeyCreated, type ApiKeyScope } from '@wecooked/shared';
import { api, fieldError, formError } from '../../lib/api';
import { Alert, Button, Card, TextField, relativeDay } from '../../components/ui';

const keysKey = ['api-keys'];

function CopyBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink-2">{label}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              window.prompt('Copy this:', text);
            }
          }}
          className="cursor-pointer text-[13px] font-semibold text-accent"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-[10px] border border-line bg-page px-3 py-2.5 text-[12px] leading-[18px] whitespace-pre">{text}</pre>
    </div>
  );
}

/** How to connect each agent, with the new key filled in. */
function Setup({ created }: { created: ApiKeyCreated }) {
  const url = `${window.location.origin}/mcp`;
  const [tab, setTab] = useState<'claude' | 'codex' | 'gemini' | 'antigravity'>('claude');
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-accent-soft p-4" role="status">
      <div>
        <p className="font-semibold text-accent-ink">Key created: {created.name}</p>
        <p className="text-[13px] text-accent-ink">Copy it now. For safety it is shown only once; if you lose it, revoke it and make a new one.</p>
      </div>
      <CopyBlock label="API key" text={created.key} />
      <div role="tablist" aria-label="Connect an agent" className="flex gap-1">
        {(['claude', 'codex', 'gemini', 'antigravity'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-semibold ${tab === t ? 'bg-surface text-ink shadow-sm' : 'text-accent-ink'}`}
          >
            {t === 'claude' ? 'Claude Code' : t === 'codex' ? 'Codex CLI' : t === 'gemini' ? 'Gemini CLI' : 'Antigravity'}
          </button>
        ))}
      </div>
      {tab === 'claude' && <CopyBlock label="Run in a terminal" text={`claude mcp add --transport http wecooked ${url} --header "Authorization: Bearer ${created.key}"`} />}
      {tab === 'codex' && (
        <>
          <CopyBlock label="1. Keep the key in an environment variable (e.g. in ~/.bashrc or ~/.zshrc)" text={`export WECOOKED_KEY="${created.key}"`} />
          <CopyBlock label="2. Add to ~/.codex/config.toml" text={`[mcp_servers.wecooked]\nurl = "${url}"\nbearer_token_env_var = "WECOOKED_KEY"`} />
        </>
      )}
      {tab === 'gemini' && (
        <CopyBlock
          label="Add to ~/.gemini/settings.json"
          text={JSON.stringify({ mcpServers: { wecooked: { httpUrl: url, headers: { Authorization: `Bearer ${created.key}` } } } }, null, 2)}
        />
      )}
      {tab === 'antigravity' && (
        // Antigravity reads a different file than Gemini CLI, and wants "serverUrl" (not "httpUrl" or "url").
        <CopyBlock
          label="Add to ~/.gemini/config/mcp_config.json"
          text={JSON.stringify({ mcpServers: { wecooked: { serverUrl: url, headers: { Authorization: `Bearer ${created.key}` } } } }, null, 2)}
        />
      )}
      <p className="text-[13px] text-accent-ink">Then ask the agent something like “Add this recipe to We Cooked: &lt;link or text&gt;”. Its recipes show “Added by AI · needs review” until someone checks them.</p>
    </div>
  );
}

export function ApiKeysCard() {
  const qc = useQueryClient();
  const keys = useQuery({ queryKey: keysKey, queryFn: () => api.get('/me/keys', z.array(ApiKey)) });
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiKeyScope>('write');
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const create = useMutation({
    mutationFn: () => api.post('/me/keys', { name, scope }, ApiKeyCreated),
    onSuccess: (k) => {
      setCreated(k);
      setName('');
      qc.invalidateQueries({ queryKey: keysKey });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: number) => api.del(`/me/keys/${id}`),
    onSuccess: (_r, id) => {
      if (created?.id === id) setCreated(null);
      qc.invalidateQueries({ queryKey: keysKey });
    },
  });

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">API keys for AI agents</h2>
        <p className="text-muted">Let Claude, Codex or Gemini read recipes and add new ones for you. Agents act as you, can never delete anything, and everything they add is marked for review.</p>
      </div>
      {created && <Setup created={created} />}
      <ul className="m-0 flex list-none flex-col p-0">
        {keys.data?.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 first:border-t-0">
            <span className="flex flex-col">
              <span className="font-semibold">
                {k.name}{' '}
                <span className="ml-1 rounded-full bg-sidebar px-2 py-0.5 text-xs font-semibold text-ink-2">{k.scope === 'write' ? 'Read and add' : 'Read only'}</span>
              </span>
              <span className="text-[13px] text-muted">
                <code>{k.prefix}…</code> · made {relativeDay(k.createdAt).toLowerCase()} · last used {k.lastUsedAt ? relativeDay(k.lastUsedAt).toLowerCase() : 'never'}
              </span>
            </span>
            <Button
              variant="danger"
              size="sm"
              busy={revoke.isPending && revoke.variables === k.id}
              onClick={() => window.confirm(`Revoke “${k.name}”? Agents using it stop working at once.`) && revoke.mutate(k.id)}
            >
              Revoke
            </Button>
          </li>
        ))}
        {keys.data?.length === 0 && !created && <li className="text-muted">No keys yet.</li>}
      </ul>
      <form
        className="flex flex-wrap items-end gap-3 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        noValidate
      >
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude on laptop" error={fieldError(create.error, 'name')} className="min-w-[220px] flex-1" />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Can</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as ApiKeyScope)} className="h-11 rounded-[10px] border border-line-strong bg-surface px-3">
            <option value="write">Read and add recipes</option>
            <option value="read">Only read</option>
          </select>
        </label>
        <Button type="submit" busy={create.isPending}>
          Create key
        </Button>
      </form>
      {formError(create.error) && <Alert>{formError(create.error)}</Alert>}
    </Card>
  );
}
