import type { RequestIdVariables } from 'hono/request-id';
import type { Logger } from 'pino';

export interface IAppEnv {
  Variables: RequestIdVariables & {
    logger: Logger;
  };
}
