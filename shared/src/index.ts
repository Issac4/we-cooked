import { z } from 'zod';

export * from './auth.js';
export * from './recipes.js';

export const APP_NAME = 'We Cooked';

/** GET /api/health */
export const HealthResponse = z.object({
  ok: z.literal(true),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
