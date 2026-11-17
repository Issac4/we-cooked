import type { z } from 'zod';
import { ApiError as ApiErrorSchema } from '@wecooked/shared';

/** A failed API call, with per-field messages when the server sent them. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(data);
    throw parsed.success
      ? new ApiError(res.status, parsed.data.error, parsed.data.fields)
      : new ApiError(res.status, `Request failed (${res.status})`);
  }
  return schema ? schema.parse(data) : (data as T);
}

export const api = {
  get: <T>(path: string, schema?: z.ZodType<T>) => call<T>('GET', path, undefined, schema),
  post: <T>(path: string, body: unknown = {}, schema?: z.ZodType<T>) => call<T>('POST', path, body, schema),
  patch: <T>(path: string, body: unknown, schema?: z.ZodType<T>) => call<T>('PATCH', path, body, schema),
  del: <T>(path: string, schema?: z.ZodType<T>) => call<T>('DELETE', path, undefined, schema),
};

/** Field message for a form input, from a failed mutation. */
export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.fields[field] : undefined;
}

/** Top-of-form message: the error text unless it is only about specific fields. */
export function formError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiError) return Object.keys(error.fields).length ? undefined : error.message;
  return 'Something went wrong. Please try again.';
}
