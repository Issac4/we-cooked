import { z } from 'zod';

/** Collection colours: a fixed palette so every choice reads well in light and dark mode. */
export const COLLECTION_COLORS = {
  green: '#2F6B4F',
  orange: '#C26A2B',
  red: '#B23B3B',
  blue: '#2D5F8B',
  purple: '#6B4C9A',
  teal: '#2C7A7B',
  brown: '#7A5C3E',
  slate: '#4A5568',
} as const;
export type CollectionColor = keyof typeof COLLECTION_COLORS;
export const CollectionColor = z.enum(Object.keys(COLLECTION_COLORS) as [CollectionColor, ...CollectionColor[]]);

export const CollectionInput = z.object({
  name: z.string().trim().min(1, 'Give the collection a name').max(60, 'Use at most 60 characters'),
  description: z.string().trim().max(300).default(''),
  color: CollectionColor.default('green'),
});
export type CollectionInput = z.infer<typeof CollectionInput>;

export const CollectionRef = z.object({ id: z.number(), name: z.string(), color: CollectionColor });
export type CollectionRef = z.infer<typeof CollectionRef>;

export const Collection = CollectionRef.extend({
  description: z.string(),
  recipeCount: z.number(),
});
export type Collection = z.infer<typeof Collection>;

export const CollectionRecipesInput = z.object({
  recipeIds: z.array(z.number().int().positive()).min(1, 'Pick at least one recipe').max(100),
});
