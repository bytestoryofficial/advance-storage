import type { UserRole } from '@advance-storage/db';

export interface IAuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface INewSession {
  token: string;
  expiresAt: Date;
}
