import type { UserStatus } from '@prisma/client';

export interface AuthUser {
  id: string;
  discordId: string;
  displayName: string;
  discordAvatarUrl: string | null;
  status: UserStatus;
  consentVersion: string | null;
  consentAcceptedAt: Date | null;
  rolesSyncedAt: Date | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}
