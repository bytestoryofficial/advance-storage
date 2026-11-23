import { pino, type Logger } from 'pino';

import { env } from '../env';

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});
