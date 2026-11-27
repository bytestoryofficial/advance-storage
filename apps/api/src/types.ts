import type { RequestIdVariables } from 'hono/request-id';
import type { Logger } from 'pino';

import type { IAuthUser } from './modules/auth/auth.types.js';

export interface IAppEnv {
  Variables: RequestIdVariables & {
    requestId: string;
    logger: Logger;
    user: IAuthUser | null;
    sessionId: string | null;
  };
}
