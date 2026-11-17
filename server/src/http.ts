import type { Context, MiddlewareHandler } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { z } from 'zod';
import type { ApiError } from '@wecooked/shared';
import type { AppEnv } from './env.js';
import { readSession } from './auth/sessions.js';
import { readApiKey } from './auth/api-keys.js';

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 410 | 429,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Parses the JSON body with a shared zod schema; field messages go back to the form. */
export async function parseBody<S extends z.ZodType>(c: Context<AppEnv>, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, 'Expected a JSON body');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    throw new HttpError(400, 'Please check the highlighted fields', fields);
  }
  return result.data;
}

export function errorResponse(c: Context, err: HttpError) {
  const body: ApiError = { error: err.message, ...(err.fields ? { fields: err.fields } : {}) };
  return c.json(body, err.status);
}

/** Best guess at the visitor's IP (Cloudflare Tunnel sets cf-connecting-ip). */
export function clientIp(c: Context): string {
  const forwarded = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0];
  if (forwarded) return forwarded.trim();
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Puts the signed-in member (or null for guests) on the context. An
 * "Authorization: Bearer wc_…" header signs the request in as the key's owner.
 */
export const loadSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.req.header('authorization');
  if (auth) {
    const found = readApiKey(c.var.db, auth);
    if (!found) throw new HttpError(401, 'That API key is not valid (it may have been revoked)');
    c.set('user', found.user);
    c.set('apiKey', found.apiKey);
    c.set('session', null);
  } else {
    const found = readSession(c);
    c.set('user', found?.user ?? null);
    c.set('session', found?.session ?? null);
    c.set('apiKey', null);
  }
  await next();
};

/** Blocks guests, and read-only API keys on anything that changes data. */
export const requireMember: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.user) throw new HttpError(401, 'Please sign in first');
  const writing = !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method);
  if (writing && c.var.apiKey?.scope === 'read') throw new HttpError(403, 'This API key is read-only');
  await next();
};

/**
 * Only a person in a browser, never an API key: account and key management,
 * household settings, and anything that deletes recipes or collections.
 */
export const humanOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.var.apiKey) throw new HttpError(403, 'API keys cannot do this. Sign in on the website instead.');
  if (!c.var.user) throw new HttpError(401, 'Please sign in first');
  await next();
};

/**
 * Cross-site request protection for cookie-authenticated writes: a browser
 * always sends Origin on POST/PATCH/DELETE, and it must match this site.
 */
export const sameOrigin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const origin = c.req.header('origin');
    if (origin) {
      let originHost = '';
      try {
        originHost = new URL(origin).host;
      } catch {
        /* invalid origin falls through to the check below */
      }
      const allowed = new Set([c.req.header('host'), new URL(c.var.config.publicUrl).host]);
      if (!allowed.has(originHost)) throw new HttpError(403, 'Request from another site was blocked');
    }
  }
  await next();
};
