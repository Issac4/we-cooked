import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HouseholdSettings } from '@wecooked/shared';
import { api, formError } from '../../lib/api';
import { settingsKey, useSettings } from '../../lib/plan';
import { Alert, Button, Card } from '../../components/ui';

/** Household rules sent to every AI agent when it connects. */
export function AiRulesCard() {
  const settings = useSettings();
  const qc = useQueryClient();
  const [rules, setRules] = useState('');
  useEffect(() => {
    if (settings.data) setRules(settings.data.aiRules);
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () => api.patch('/settings', { aiRules: rules }, HouseholdSettings),
    onSuccess: (s) => qc.setQueryData(settingsKey, s),
  });
  const unchanged = rules === (settings.data?.aiRules ?? '');
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold">Rules for AI agents</h2>
        <p className="text-muted">Sent to Claude, Codex or Gemini every time they connect, on top of the built-in format rules.</p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="sr-only">Rules for AI agents</span>
        <textarea
          rows={5}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder={'e.g.\nUse metric units.\nEnglish name as the title, Chinese name as the other name.\nAdd the YouTube link as the source.'}
          className="rounded-xl border border-line-strong bg-page px-3.5 py-3 text-ink placeholder:text-muted"
        />
      </label>
      {formError(save.error) && <Alert>{formError(save.error)}</Alert>}
      <div className="flex items-center justify-end gap-3">
        {save.isSuccess && unchanged && (
          <span className="text-[13px] text-accent-ink" role="status">
            Saved.
          </span>
        )}
        <Button busy={save.isPending} disabled={unchanged} onClick={() => save.mutate()}>
          Save rules
        </Button>
      </div>
    </Card>
  );
}
