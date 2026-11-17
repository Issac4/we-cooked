import {
  parseQuantity,
  parseTimer,
  formatQuantity,
  formatTimerInput,
  RecipeInput,
  type Recipe,
  type RecipeInput as RecipeInputT,
  type StepSection,
} from '@wecooked/shared';

let seq = 0;
export const newKey = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export interface IngRow {
  key: string;
  quantity: string;
  unit: string;
  name: string;
  note: string;
}
export interface IngSection {
  key: string;
  name: string;
  items: IngRow[];
}
export interface StepRow {
  key: string;
  section: StepSection;
  title: string;
  text: string;
  timer: string;
}
export interface LinkRow {
  key: string;
  url: string;
  title: string;
}

/** Everything the form edits, kept as the strings people type. */
export interface FormState {
  title: string;
  otherName: string;
  description: string;
  coverPhoto: string | null;
  servings: string;
  prepMins: string;
  cookMins: string;
  ingredients: IngSection[];
  steps: StepRow[];
  links: LinkRow[];
  tagIds: number[];
}

export const emptyIngredient = (): IngRow => ({ key: newKey('i'), quantity: '', unit: '', name: '', note: '' });
export const emptyStep = (section: StepSection): StepRow => ({ key: newKey('s'), section, title: '', text: '', timer: '' });
export const emptyLink = (): LinkRow => ({ key: newKey('l'), url: '', title: '' });

export function emptyForm(): FormState {
  return {
    title: '',
    otherName: '',
    description: '',
    coverPhoto: null,
    servings: '',
    prepMins: '',
    cookMins: '',
    ingredients: [{ key: newKey('g'), name: '', items: [emptyIngredient(), emptyIngredient(), emptyIngredient()] }],
    steps: [emptyStep('preparation'), emptyStep('cooking')],
    links: [],
    tagIds: [],
  };
}

const num = (v: number | null) => (v === null ? '' : String(v));

export function formFromRecipe(r: Recipe): FormState {
  return {
    title: r.title,
    otherName: r.otherName,
    description: r.description,
    coverPhoto: r.coverPhoto,
    servings: num(r.servings),
    prepMins: num(r.prepMins),
    cookMins: num(r.cookMins),
    ingredients: (r.ingredients.length ? r.ingredients : [{ name: '', items: [] }]).map((s) => ({
      key: newKey('g'),
      name: s.name,
      items: [
        ...s.items.map((i) => ({ key: newKey('i'), quantity: formatQuantity(i.quantity), unit: i.unit, name: i.name, note: i.note })),
        emptyIngredient(),
      ],
    })),
    steps: r.steps.length
      ? r.steps.map((s) => ({ key: newKey('s'), section: s.section, title: s.title, text: s.text, timer: formatTimerInput(s.timerMins) }))
      : [emptyStep('preparation'), emptyStep('cooking')],
    links: r.links.map((l) => ({ key: newKey('l'), url: l.url, title: l.title })),
    tagIds: r.tags.map((t) => t.id),
  };
}

/** Error messages keyed by "<row key>.<field>" or a top-level field name. */
export type FormErrors = Record<string, string>;

function intOrNull(value: string): number | null | 'bad' {
  const s = value.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : 'bad';
}

/**
 * Turns the form into the API body. Blank rows are skipped. Errors use the
 * form's own row keys, so messages land next to the right input even after
 * blank rows are dropped (server paths are translated with `pathKeys`).
 */
export function toInput(form: FormState): { input: RecipeInputT | null; errors: FormErrors; pathKeys: Map<string, string> } {
  const errors: FormErrors = {};
  const pathKeys = new Map<string, string>();

  const numbers: Record<'servings' | 'prepMins' | 'cookMins', number | null> = { servings: null, prepMins: null, cookMins: null };
  for (const field of ['servings', 'prepMins', 'cookMins'] as const) {
    const v = intOrNull(form[field]);
    if (v === 'bad') errors[field] = 'Use a whole number';
    else numbers[field] = field === 'servings' && v === 0 ? null : v;
  }

  const ingredients: RecipeInputT['ingredients'] = [];
  form.ingredients.forEach((section) => {
    const items: RecipeInputT['ingredients'][number]['items'] = [];
    const si = ingredients.length;
    section.items.forEach((row) => {
      const blank = !row.name.trim() && !row.quantity.trim() && !row.unit.trim() && !row.note.trim();
      if (blank) return;
      const quantity = parseQuantity(row.quantity);
      if (row.quantity.trim() && quantity === null) errors[`${row.key}.quantity`] = 'Use a number like 2, 1.5 or 1/2';
      pathKeys.set(`ingredients.${si}.items.${items.length}`, row.key);
      items.push({ quantity, unit: row.unit, name: row.name, note: row.note });
    });
    if (items.length || section.name.trim()) {
      pathKeys.set(`ingredients.${si}`, section.key);
      ingredients.push({ name: section.name, items });
    }
  });

  const steps: RecipeInputT['steps'] = [];
  for (const section of ['preparation', 'cooking'] as const) {
    for (const row of form.steps.filter((s) => s.section === section)) {
      if (!row.text.trim() && !row.title.trim() && !row.timer.trim()) continue;
      const timer = parseTimer(row.timer);
      if (timer === 'bad') errors[`${row.key}.timerMins`] = 'Use minutes (15), m:ss (1:30) or seconds (45s)';
      pathKeys.set(`steps.${steps.length}`, row.key);
      steps.push({ section, title: row.title, text: row.text, timerMins: timer === 'bad' ? null : timer });
    }
  }

  const links: RecipeInputT['links'] = [];
  for (const row of form.links) {
    if (!row.url.trim()) continue;
    pathKeys.set(`links.${links.length}`, row.key);
    links.push({ url: row.url.trim(), title: row.title });
  }

  const parsed = RecipeInput.safeParse({
    title: form.title,
    otherName: form.otherName,
    description: form.description,
    coverPhoto: form.coverPhoto,
    ...numbers,
    ingredients,
    steps,
    links,
    tagIds: form.tagIds,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = translatePath(issue.path.join('.'), pathKeys);
      errors[key] ??= issue.message;
    }
  }
  return { input: parsed.success && !Object.keys(errors).length ? parsed.data : null, errors, pathKeys };
}

/** "steps.2.text" -> "<step row key>.text"; "title" stays "title". */
export function translatePath(path: string, pathKeys: Map<string, string>): string {
  const parts = path.split('.');
  for (let cut = parts.length - 1; cut > 0; cut--) {
    const key = pathKeys.get(parts.slice(0, cut).join('.'));
    if (key) return [key, ...parts.slice(cut)].join('.');
  }
  return path;
}
