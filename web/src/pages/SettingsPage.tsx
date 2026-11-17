import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { TagGroup } from '@wecooked/shared';
import { api, formError } from '../lib/api';
import { tagsKey, useTagGroups } from '../lib/recipes';
import { Alert, Button, Card } from '../components/ui';
import { PlanSettings } from './settings/PlanSettings';
import { AiRulesCard } from './settings/AiRulesCard';

/** Small inline "name" editor used for groups and tags. */
function InlineName({ initial, label, onSave, onCancel, busy }: { initial: string; label: string; onSave: (name: string) => void; onCancel: () => void; busy: boolean }) {
  const [name, setName] = useState(initial);
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name.trim());
      }}
    >
      <input
        autoFocus
        aria-label={label}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        className="h-9 w-40 rounded-[9px] border border-line-strong bg-surface px-2.5"
      />
      <Button type="submit" size="sm" busy={busy} disabled={!name.trim()}>
        Save
      </Button>
      <button type="button" aria-label="Cancel" onClick={onCancel} className="flex size-9 cursor-pointer items-center justify-center rounded-[9px] text-muted hover:bg-sidebar">
        <X size={16} />
      </button>
    </form>
  );
}

function GroupEditor({ group }: { group: TagGroup }) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: tagsKey });
    qc.invalidateQueries({ queryKey: ['recipes'] });
  };
  const [editing, setEditing] = useState<string | null>(null); // 'group' | 'new' | `tag:<id>`
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
  });

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        {editing === 'group' ? (
          <InlineName initial={group.name} label="Group name" busy={run.isPending} onCancel={() => setEditing(null)} onSave={(name) => run.mutate(() => api.patch(`/tags/groups/${group.id}`, { name }))} />
        ) : (
          <>
            <h3 className="font-semibold">{group.name}</h3>
            <button type="button" aria-label={`Rename ${group.name}`} onClick={() => setEditing('group')} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-sidebar">
              <Pencil size={14} />
            </button>
            <button
              type="button"
              aria-label={`Delete ${group.name}`}
              onClick={() => {
                if (window.confirm(`Delete the “${group.name}” group and its ${group.tags.length} filters? Recipes stay; they just lose these tags.`)) {
                  run.mutate(() => api.del(`/tags/groups/${group.id}`));
                }
              }}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-sidebar hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {group.tags.map((t) =>
          editing === `tag:${t.id}` ? (
            <InlineName key={t.id} initial={t.name} label="Filter name" busy={run.isPending} onCancel={() => setEditing(null)} onSave={(name) => run.mutate(() => api.patch(`/tags/${t.id}`, { name }))} />
          ) : (
            <span key={t.id} className="flex items-center rounded-full border border-line-strong bg-surface pl-3 text-[13px]">
              <button type="button" onClick={() => setEditing(`tag:${t.id}`)} className="cursor-pointer py-1.5" aria-label={`Rename ${t.name}`}>
                {t.name}
              </button>
              <button
                type="button"
                aria-label={`Delete ${t.name}`}
                onClick={() => {
                  if (window.confirm(`Delete “${t.name}”? Recipes stay; they just lose this tag.`)) run.mutate(() => api.del(`/tags/${t.id}`));
                }}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted hover:text-danger"
              >
                <X size={13} />
              </button>
            </span>
          ),
        )}
        {editing === 'new' ? (
          <InlineName initial="" label={`New filter in ${group.name}`} busy={run.isPending} onCancel={() => setEditing(null)} onSave={(name) => run.mutate(() => api.post('/tags', { groupId: group.id, name }))} />
        ) : (
          <button type="button" onClick={() => setEditing('new')} className="flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-muted px-3 py-1.5 text-[13px] font-semibold text-ink-2">
            <Plus size={13} aria-hidden="true" /> Add
          </button>
        )}
      </div>
      {run.isError && <Alert>{formError(run.error)}</Alert>}
    </div>
  );
}

function NewGroup() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const create = useMutation({
    mutationFn: (name: string) => api.post('/tags/groups', { name }),
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: tagsKey });
    },
  });
  return (
    <div className="flex flex-col gap-2">
      {open ? (
        <InlineName initial="" label="New group name" busy={create.isPending} onCancel={() => setOpen(false)} onSave={(name) => create.mutate(name)} />
      ) : (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setOpen(true)}>
          <Plus size={14} aria-hidden="true" /> Add a group (e.g. Cooking method)
        </Button>
      )}
      {create.isError && <Alert>{formError(create.error)}</Alert>}
    </div>
  );
}

export function SettingsPage() {
  const groups = useTagGroups();
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-[28px] leading-9 font-bold tracking-tight">Household settings</h1>
        <p className="text-muted">Shared by everyone in the household. Any member can change these.</p>
      </div>
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">Filter groups</h2>
          <p className="text-muted">The pill groups in the sidebar. Click a filter to rename it.</p>
        </div>
        {groups.data?.map((g) => <GroupEditor key={g.id} group={g} />)}
        <NewGroup />
      </Card>
      <PlanSettings />
      <AiRulesCard />
    </div>
  );
}
