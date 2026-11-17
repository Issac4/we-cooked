import { z } from 'zod';

/** Letters in any language, digits, spaces and . _ - ; 2–32 characters. */
export const Username = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters')
  .max(32, 'Use at most 32 characters')
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u, 'Use letters, numbers, spaces, dots, dashes or underscores');

export const Password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200, 'Use at most 200 characters');

/** Key used for case-insensitive uniqueness and login lookup. */
export function usernameKey(username: string): string {
  return username.trim().normalize('NFKC').toLowerCase();
}

export const LoginRequest = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const JoinRequest = z.object({
  token: z.string().min(1),
  username: Username,
  password: Password,
});
export type JoinRequest = z.infer<typeof JoinRequest>;

export const ResetRequest = z.object({
  token: z.string().min(1),
  password: Password,
});
export type ResetRequest = z.infer<typeof ResetRequest>;

export const Me = z.object({
  id: z.number(),
  username: z.string(),
  /** Set when the password was reset from /admin and the member has not dismissed the notice. */
  passwordResetAt: z.number().nullable(),
});
export type Me = z.infer<typeof Me>;

export const MeResponse = z.object({ user: Me.nullable() });
export type MeResponse = z.infer<typeof MeResponse>;

export const UpdateMe = z.object({ username: Username });
export type UpdateMe = z.infer<typeof UpdateMe>;

export const ChangePassword = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: Password,
});
export type ChangePassword = z.infer<typeof ChangePassword>;

export const DeviceSession = z.object({
  id: z.string(),
  device: z.string(),
  createdAt: z.number(),
  lastSeenAt: z.number(),
  current: z.boolean(),
});
export type DeviceSession = z.infer<typeof DeviceSession>;

export const TokenStatus = z.object({ valid: z.literal(true), username: z.string().optional() });
export type TokenStatus = z.infer<typeof TokenStatus>;

// ---- /admin ----

export const AdminUnlock = z.object({ password: z.string().min(1, 'Enter the admin password') });

export const AdminState = z.object({
  unlocked: z.boolean(),
  /** Epoch ms when the admin page locks itself. */
  expiresAt: z.number().nullable(),
});
export type AdminState = z.infer<typeof AdminState>;

export const AdminMember = z.object({
  id: z.number(),
  username: z.string(),
  createdAt: z.number(),
  devices: z.number(),
  lastActiveAt: z.number().nullable(),
});
export type AdminMember = z.infer<typeof AdminMember>;

export const AdminInvite = z.object({
  id: z.number(),
  url: z.string(),
  createdAt: z.number(),
  expiresAt: z.number(),
});
export type AdminInvite = z.infer<typeof AdminInvite>;

export const AdminLink = z.object({ url: z.string(), expiresAt: z.number() });
export type AdminLink = z.infer<typeof AdminLink>;

export const AdminLogEntry = z.object({ id: z.number(), at: z.number(), message: z.string() });
export type AdminLogEntry = z.infer<typeof AdminLogEntry>;

/** Error body returned by every failing API call. */
export const ApiError = z.object({
  error: z.string(),
  fields: z.record(z.string(), z.string()).optional(),
});
export type ApiError = z.infer<typeof ApiError>;
