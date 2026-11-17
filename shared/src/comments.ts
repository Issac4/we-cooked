import { z } from 'zod';

export const MAX_RATING = 5;
export const Rating = z.number().int().min(1, 'Pick 1 to 5 stars').max(MAX_RATING, 'Pick 1 to 5 stars');

/** A note is some text, a star rating, or both. */
export const CommentInput = z
  .object({
    body: z.string().trim().max(2000, 'Keep it under 2000 characters').default(''),
    rating: Rating.nullable().default(null),
  })
  .refine((c) => c.body.length > 0 || c.rating !== null, { message: 'Write something or pick a rating first', path: ['body'] });
export type CommentInput = z.input<typeof CommentInput>;

export const Comment = z.object({
  id: z.number(),
  recipeId: z.number(),
  author: z.string().nullable(),
  body: z.string(),
  rating: z.number().nullable(),
  createdAt: z.number(),
  editedAt: z.number().nullable(),
  /** True when the signed-in member wrote it (and so may edit or delete it). */
  mine: z.boolean(),
});
export type Comment = z.infer<typeof Comment>;

/** Household score: each member's most recent rating counts once. */
export const RatingSummary = z.object({
  average: z.number(),
  count: z.number(),
  people: z.array(z.object({ name: z.string(), rating: z.number() })),
});
export type RatingSummary = z.infer<typeof RatingSummary>;
