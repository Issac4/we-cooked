import { z } from 'zod';

// ---------- Quantities ----------

const FRACTIONS: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

/**
 * Reads what people type in the quantity box: "2", "1.5", "1/2", "1 1/2", "½", "1½".
 * Returns null for empty or unreadable input (e.g. "a pinch" belongs in the unit).
 */
export function parseQuantity(input: string): number | null {
  let s = input.trim();
  if (!s) return null;
  let total = 0;
  for (const [ch, value] of Object.entries(FRACTIONS)) {
    if (s.includes(ch)) {
      total += value;
      s = s.replace(ch, '').trim();
    }
  }
  if (!s) return total || null;
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return total + Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) ? total + Number(frac[1]) / Number(frac[2]) : null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? total + n : null;
}

/** 0.5 -> "½", 1.5 -> "1½", 2.333 -> "2⅓", 2.4 -> "2.4". */
export function formatQuantity(value: number | null): string {
  if (value === null) return '';
  const whole = Math.floor(value + 1e-9);
  const rest = value - whole;
  for (const [ch, v] of Object.entries(FRACTIONS)) {
    if (Math.abs(rest - v) < 0.02) return whole ? `${whole}${ch}` : ch;
  }
  if (rest < 0.02) return String(whole);
  return String(Math.round(value * 10) / 10);
}

// ---------- Recipe parts ----------

export const Ingredient = z.object({
  quantity: z.number().nonnegative().max(100_000).nullable().describe('Amount for the recipe as written; null when not measured'),
  unit: z.string().trim().max(40).default('').describe('e.g. g, ml, tbsp, cloves, "a pinch"'),
  name: z.string().trim().min(1, 'Name the ingredient').max(120),
  note: z.string().trim().max(200).default('').describe('e.g. "finely chopped", brand advice'),
});
export type Ingredient = z.infer<typeof Ingredient>;

export const IngredientSection = z.object({
  name: z.string().trim().max(60).default('').describe('Empty for the main list, or e.g. "Marinade", "Sauce"'),
  items: z.array(Ingredient).max(100),
});
export type IngredientSection = z.infer<typeof IngredientSection>;

export const STEP_SECTIONS = ['preparation', 'cooking'] as const;
export const StepSection = z.enum(STEP_SECTIONS);
export type StepSection = z.infer<typeof StepSection>;

export const Step = z.object({
  section: StepSection.describe('preparation = before heat (washing, cutting, marinating); cooking = on the heat and serving'),
  title: z.string().trim().max(120).default(''),
  text: z.string().trim().min(1, 'Describe the step').max(4000).describe('Markdown allowed'),
  timerMins: z.number().int().positive().max(24 * 60).nullable().default(null),
});
export type Step = z.infer<typeof Step>;

export const SourceLink = z.object({
  url: z.url({ protocol: /^https?$/, message: 'Use a full https:// link' }).max(2000),
  title: z.string().trim().max(200).default(''),
});
export type SourceLink = z.infer<typeof SourceLink>;

const minutes = z.number().int().nonnegative().max(7 * 24 * 60).nullable();

/** What a member (or an AI agent) sends to create or edit a recipe. */
export const RecipeInput = z.object({
  title: z.string().trim().min(1, 'Give the recipe a name').max(160),
  otherName: z.string().trim().max(160).default('').describe('Optional second name, e.g. the Chinese name'),
  description: z.string().trim().max(4000).default(''),
  coverPhoto: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).nullable().default(null).describe('Upload id from POST /api/uploads'),
  servings: z.number().int().min(1).max(100).nullable().default(null),
  prepMins: minutes.default(null),
  cookMins: minutes.default(null),
  ingredients: z.array(IngredientSection).max(20).default([]),
  steps: z.array(Step).max(100).default([]),
  links: z.array(SourceLink).max(20).default([]),
  tagIds: z.array(z.number().int().positive()).max(50).default([]),
});
export type RecipeInput = z.infer<typeof RecipeInput>;
export type RecipeInputDraft = z.input<typeof RecipeInput>;

export const RecipeUpdate = RecipeInput.extend({
  /** updatedAt of the version being edited; a newer save by someone else is refused. */
  baseUpdatedAt: z.number(),
});
export type RecipeUpdate = z.infer<typeof RecipeUpdate>;

// ---------- Tags ----------

export const Tag = z.object({ id: z.number(), groupId: z.number(), name: z.string() });
export type Tag = z.infer<typeof Tag>;

export const TagGroup = z.object({ id: z.number(), name: z.string(), tags: z.array(Tag) });
export type TagGroup = z.infer<typeof TagGroup>;

export const TagName = z.string().trim().min(1, 'Enter a name').max(40, 'Use at most 40 characters');
export const TagGroupInput = z.object({ name: TagName });
export const TagInput = z.object({ groupId: z.number().int().positive(), name: TagName });
export const RenameInput = z.object({ name: TagName });

// ---------- Responses ----------

export const RecipeCard = z.object({
  id: z.number(),
  title: z.string(),
  otherName: z.string(),
  coverPhoto: z.string().nullable(),
  servings: z.number().nullable(),
  prepMins: z.number().nullable(),
  cookMins: z.number().nullable(),
  tags: z.array(Tag),
  needsReview: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type RecipeCard = z.infer<typeof RecipeCard>;

export const RecipeList = z.object({ recipes: z.array(RecipeCard), total: z.number() });
export type RecipeList = z.infer<typeof RecipeList>;

export const Recipe = RecipeCard.extend({
  description: z.string(),
  ingredients: z.array(IngredientSection),
  steps: z.array(Step),
  links: z.array(SourceLink),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
export type Recipe = z.infer<typeof Recipe>;

export const TrashItem = z.object({
  id: z.number(),
  title: z.string(),
  coverPhoto: z.string().nullable(),
  deletedAt: z.number(),
  deletedBy: z.string().nullable(),
  purgeAt: z.number(),
});
export type TrashItem = z.infer<typeof TrashItem>;

export const Upload = z.object({ id: z.string(), width: z.number(), height: z.number() });
export type Upload = z.infer<typeof Upload>;

export const LinkPreview = z.object({ title: z.string() });
export type LinkPreview = z.infer<typeof LinkPreview>;

export const RECIPE_SORTS = ['new', 'title', 'time', 'updated'] as const;
export type RecipeSort = (typeof RECIPE_SORTS)[number];

/** Image URLs for an upload id. */
export function photoUrl(id: string, size: 'full' | 'thumb' = 'full'): string {
  return size === 'thumb' ? `/uploads/${id}-thumb.webp` : `/uploads/${id}.webp`;
}

export const TRASH_DAYS = 30;
