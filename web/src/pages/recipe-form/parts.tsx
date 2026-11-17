import { useRef, useState, type InputHTMLAttributes } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { LinkPreview, Tag, photoUrl, type StepSection, type TagGroup } from '@wecooked/shared';
import { api, ApiError, formError, uploadPhoto } from '../../lib/api';
import { tagsKey } from '../../lib/recipes';
import { Pill } from '../../components/Filters';
import { Alert, Button } from '../../components/ui';
import { emptyIngredient, emptyLink, emptyStep, newKey, type FormErrors, type FormState, type IngSection, type StepRow } from './state';

export type SetForm = (update: (f: FormState) => FormState) => void;

const inputCls = (error?: string) =>
  `h-11 w-full min-w-0 rounded-[10px] border bg-surface px-3 text-ink placeholder:text-muted ${error ? 'border-danger' : 'border-line-strong'}`;

/** Input with a visually hidden label (for dense rows) and an error line. */
function RowInput({ label, error, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="sr-only">{label}</span>
      <input {...props} aria-invalid={error ? true : undefined} className={inputCls(error)} />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}

function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-muted hover:bg-sidebar hover:text-ink disabled:cursor-default disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {hint && <p className="text-[13px] text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// ---------- Cover photo ----------

export function CoverPhoto({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({ mutationFn: uploadPhoto, onSuccess: (u) => onChange(u.id) });
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-ink-2">Cover photo</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-[120px] w-[180px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-page text-muted">
          {value ? <img src={photoUrl(value, 'thumb')} alt="Cover photo preview" className="h-full w-full object-cover" /> : <ImagePlus size={28} aria-hidden="true" />}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" busy={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? 'Uploading…' : value ? 'Replace photo' : 'Choose photo'}
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              Remove photo
            </Button>
          )}
        </div>
      </div>
      {upload.isError && <Alert>{formError(upload.error)}</Alert>}
    </div>
  );
}

// ---------- Tags ----------

function NewTag({ group, onCreated }: { group: TagGroup; onCreated: (id: number) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => api.post('/tags', { groupId: group.id, name }, Tag),
    onSuccess: (tag) => {
      qc.invalidateQueries({ queryKey: tagsKey });
      onCreated(tag.id);
      setName('');
      setOpen(false);
    },
    onError: (err) => {
      // Already exists: just select the existing one.
      if (err instanceof ApiError && err.status === 409) {
        const existing = group.tags.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
        if (existing) {
          onCreated(existing.id);
          setName('');
          setOpen(false);
        }
      }
    },
  });
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="cursor-pointer rounded-full border border-dashed border-muted px-3 py-[7px] text-[13px] font-semibold text-ink-2">
        + New
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <input
        autoFocus
        aria-label={`New tag in ${group.name}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Name"
        className="h-[34px] w-32 rounded-full border border-line-strong bg-surface px-3 text-[13px]"
      />
      <Button size="sm" busy={create.isPending} disabled={!name.trim()} onClick={() => create.mutate()}>
        Add
      </Button>
      <IconButton label="Cancel" onClick={() => setOpen(false)}>
        <X size={16} />
      </IconButton>
    </span>
  );
}

export function TagPicker({ groups, value, onChange }: { groups: TagGroup[]; value: number[]; onChange: (ids: number[]) => void }) {
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.id} className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-ink-2">{g.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {g.tags.map((t) => (
              <Pill key={t.id} active={value.includes(t.id)} onClick={() => toggle(t.id)}>
                {t.name}
              </Pill>
            ))}
            <NewTag group={g} onCreated={(id) => onChange(value.includes(id) ? value : [...value, id])} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Ingredients ----------

function focusLater(selector: string) {
  requestAnimationFrame(() => document.querySelector<HTMLInputElement>(selector)?.focus());
}

export function IngredientsEditor({ sections, setForm, errors }: { sections: IngSection[]; setForm: SetForm; errors: FormErrors }) {
  const updateSection = (key: string, change: (s: IngSection) => IngSection) =>
    setForm((f) => ({ ...f, ingredients: f.ingredients.map((s) => (s.key === key ? change(s) : s)) }));

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section, si) => (
        <div key={section.key} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <RowInput
              label={si === 0 ? 'Section name (optional)' : 'Section name'}
              placeholder={si === 0 ? 'Section name (optional, e.g. Main)' : 'Section name, e.g. Marinade or Sauce'}
              value={section.name}
              onChange={(e) => updateSection(section.key, (s) => ({ ...s, name: e.target.value }))}
              className="flex-1 [&_input]:font-semibold"
            />
            {sections.length > 1 && (
              <IconButton label="Remove section" onClick={() => setForm((f) => ({ ...f, ingredients: f.ingredients.filter((s) => s.key !== section.key) }))}>
                <Trash2 size={18} />
              </IconButton>
            )}
          </div>
          <div className="hidden grid-cols-[84px_100px_minmax(0,1fr)_minmax(0,1fr)_44px] gap-2 px-0.5 text-xs font-semibold text-muted md:grid" aria-hidden="true">
            <span>Amount</span>
            <span>Unit</span>
            <span>Ingredient</span>
            <span>Note</span>
          </div>
          {section.items.map((row, ii) => {
            const set = (field: 'quantity' | 'unit' | 'name' | 'note', value: string) =>
              updateSection(section.key, (s) => ({ ...s, items: s.items.map((r) => (r.key === row.key ? { ...r, [field]: value } : r)) }));
            const addBelow = () => {
              const fresh = emptyIngredient();
              updateSection(section.key, (s) => {
                const items = [...s.items];
                items.splice(ii + 1, 0, fresh);
                return { ...s, items };
              });
              focusLater(`[data-focus="${fresh.key}"]`);
            };
            return (
              <div key={row.key} className="grid grid-cols-[84px_minmax(0,1fr)_44px] gap-2 border-b border-line pb-2 md:grid-cols-[84px_100px_minmax(0,1fr)_minmax(0,1fr)_44px] md:border-0 md:pb-0">
                <RowInput label="Amount" placeholder="Qty" inputMode="decimal" data-focus={row.key} value={row.quantity} onChange={(e) => set('quantity', e.target.value)} error={errors[`${row.key}.quantity`]} />
                <RowInput label="Unit" placeholder="Unit" value={row.unit} onChange={(e) => set('unit', e.target.value)} />
                <IconButton label="Remove ingredient" onClick={() => updateSection(section.key, (s) => ({ ...s, items: s.items.filter((r) => r.key !== row.key) }))}>
                  <X size={18} />
                </IconButton>
                <RowInput
                  label="Ingredient"
                  placeholder="Ingredient"
                  value={row.name}
                  onChange={(e) => set('name', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addBelow();
                    }
                  }}
                  error={errors[`${row.key}.name`]}
                  className="col-span-3 md:col-span-1 md:col-start-3 md:row-start-1"
                />
                <RowInput label="Note" placeholder="Note, e.g. finely chopped" value={row.note} onChange={(e) => set('note', e.target.value)} className="col-span-3 md:col-span-1 md:col-start-4 md:row-start-1" />
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const fresh = emptyIngredient();
                updateSection(section.key, (s) => ({ ...s, items: [...s.items, fresh] }));
                focusLater(`[data-focus="${fresh.key}"]`);
              }}
            >
              <Plus size={14} aria-hidden="true" /> Add ingredient
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setForm((f) => ({ ...f, ingredients: [...f.ingredients, { key: newKey('g'), name: '', items: [emptyIngredient(), emptyIngredient()] }] }))}
      >
        <Plus size={14} aria-hidden="true" /> Add section (e.g. Marinade)
      </Button>
      <p className="text-[13px] text-muted">Tip: press Enter in an ingredient name to add the next one. Amounts like 1/2 or 1½ work.</p>
    </div>
  );
}

// ---------- Steps ----------

export function StepsEditor({ steps, setForm, errors }: { steps: StepRow[]; setForm: SetForm; errors: FormErrors }) {
  const update = (key: string, patch: Partial<StepRow>) => setForm((f) => ({ ...f, steps: f.steps.map((s) => (s.key === key ? { ...s, ...patch } : s)) }));
  const move = (key: string, dir: -1 | 1) =>
    setForm((f) => {
      const row = f.steps.find((s) => s.key === key)!;
      const same = f.steps.filter((s) => s.section === row.section);
      const i = same.findIndex((s) => s.key === key);
      const other = same[i + dir];
      if (!other) return f;
      const list = [...f.steps];
      const a = list.findIndex((s) => s.key === key);
      const b = list.findIndex((s) => s.key === other.key);
      [list[a], list[b]] = [list[b]!, list[a]!];
      return { ...f, steps: list };
    });

  let n = 0;
  return (
    <div className="flex flex-col gap-6">
      {(['preparation', 'cooking'] as StepSection[]).map((section) => {
        const rows = steps.filter((s) => s.section === section);
        return (
          <div key={section} className="flex flex-col gap-3">
            <h3 className="font-bold">{section === 'preparation' ? 'Preparation' : 'Cooking'}</h3>
            <p className="-mt-2 text-[13px] text-muted">
              {section === 'preparation' ? 'Before the heat: washing, cutting, marinating.' : 'On the heat, and serving.'}
            </p>
            {rows.map((row, i) => {
              n += 1;
              return (
                <div key={row.key} className="flex gap-3 rounded-xl border border-line p-3">
                  <span className="mt-2.5 flex size-[26px] shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-page">{n}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <RowInput label="Step title (optional)" placeholder="Step title (optional)" value={row.title} onChange={(e) => update(row.key, { title: e.target.value })} data-focus={row.key} />
                    <label className="flex flex-col gap-1">
                      <span className="sr-only">What to do</span>
                      <textarea
                        rows={3}
                        placeholder="What to do. **Bold** and lists work."
                        value={row.text}
                        onChange={(e) => update(row.key, { text: e.target.value })}
                        aria-invalid={errors[`${row.key}.text`] ? true : undefined}
                        className={`min-h-[80px] rounded-[10px] border bg-surface px-3 py-2.5 text-ink placeholder:text-muted ${errors[`${row.key}.text`] ? 'border-danger' : 'border-line-strong'}`}
                      />
                      {errors[`${row.key}.text`] && <span className="text-xs text-danger">{errors[`${row.key}.text`]}</span>}
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-[13px] text-ink-2">
                        Timer
                        <input
                          inputMode="numeric"
                          placeholder="min"
                          value={row.timer}
                          onChange={(e) => update(row.key, { timer: e.target.value })}
                          className={`h-9 w-20 rounded-[9px] border bg-surface px-2.5 ${errors[`${row.key}.timerMins`] ? 'border-danger' : 'border-line-strong'}`}
                        />
                        minutes
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-ink-2">
                        Part
                        <select value={row.section} onChange={(e) => update(row.key, { section: e.target.value as StepSection })} className="h-9 rounded-[9px] border border-line-strong bg-surface px-2">
                          <option value="preparation">Preparation</option>
                          <option value="cooking">Cooking</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <IconButton label="Move step up" disabled={i === 0} onClick={() => move(row.key, -1)}>
                      <ArrowUp size={16} />
                    </IconButton>
                    <IconButton label="Move step down" disabled={i === rows.length - 1} onClick={() => move(row.key, 1)}>
                      <ArrowDown size={16} />
                    </IconButton>
                    <IconButton label="Remove step" onClick={() => setForm((f) => ({ ...f, steps: f.steps.filter((s) => s.key !== row.key) }))}>
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => {
                const fresh = emptyStep(section);
                setForm((f) => ({ ...f, steps: [...f.steps, fresh] }));
                focusLater(`[data-focus="${fresh.key}"]`);
              }}
            >
              <Plus size={14} aria-hidden="true" /> Add {section === 'preparation' ? 'preparation' : 'cooking'} step
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Links ----------

export function LinksEditor({ links, setForm, errors }: { links: FormState['links']; setForm: SetForm; errors: FormErrors }) {
  const update = (key: string, patch: Partial<FormState['links'][number]>) =>
    setForm((f) => ({ ...f, links: f.links.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const fetchTitle = async (key: string, url: string) => {
    if (!/youtu\.?be/.test(url)) return;
    try {
      const { title } = await api.get(`/link-preview?url=${encodeURIComponent(url)}`, LinkPreview);
      setForm((f) => ({ ...f, links: f.links.map((l) => (l.key === key && !l.title ? { ...l, title } : l)) }));
    } catch {
      /* no title is fine */
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {links.map((l) => (
        <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_44px] gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px]">
          <RowInput label="Link" placeholder="https://…" inputMode="url" value={l.url} onChange={(e) => update(l.key, { url: e.target.value })} onBlur={(e) => fetchTitle(l.key, e.target.value)} error={errors[`${l.key}.url`]} />
          <IconButton label="Remove link" onClick={() => setForm((f) => ({ ...f, links: f.links.filter((x) => x.key !== l.key) }))}>
            <X size={18} />
          </IconButton>
          <RowInput label="Link title" placeholder="Title (YouTube fills this in)" value={l.title} onChange={(e) => update(l.key, { title: e.target.value })} className="col-span-2 md:col-span-1 md:col-start-2 md:row-start-1" />
        </div>
      ))}
      <Button variant="ghost" size="sm" className="self-start" onClick={() => setForm((f) => ({ ...f, links: [...f.links, emptyLink()] }))}>
        <Plus size={14} aria-hidden="true" /> Add link
      </Button>
    </div>
  );
}
