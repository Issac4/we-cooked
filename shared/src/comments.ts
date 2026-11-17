import { z } from 'zod';

export const CommentInput = z.object({
  body: z.string().trim().min(1, 'Write something first').max(2000, 'Keep it under 2000 characters'),
});
export type CommentInput = z.infer<typeof CommentInput>;

export const Comment = z.object({
  id: z.number(),
  recipeId: z.number(),
  author: z.string().nullable(),
  body: z.string(),
  createdAt: z.number(),
  editedAt: z.number().nullable(),
  /** True when the signed-in member wrote it (and so may edit or delete it). */
  mine: z.boolean(),
});
export type Comment = z.infer<typeof Comment>;
