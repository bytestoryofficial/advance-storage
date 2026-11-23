let shuttingDown: boolean = false;

/** True once SIGTERM/SIGINT was received; `/ready` returns 503 from then on. */
export const isShuttingDown = (): boolean => shuttingDown;
export const SHUTTING_DOWN_STATUS = 'shutting_down';

export const markShuttingDown = (): void => {
  shuttingDown = true;
};
