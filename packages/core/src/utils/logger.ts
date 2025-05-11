import { Signale } from 'signale';

export function createLogger(verbose = false, scope?: string) {
  const logger = new Signale({
    scope,
    disabled: !verbose
  });

  return {
    info: (message: string, ...args: any[]) => logger.info(message, ...args),
    success: (message: string, ...args: any[]) => logger.success(message, ...args),
    error: (message: string, ...args: any[]) => logger.error(message, ...args),
    warn: (message: string, ...args: any[]) => logger.warn(message, ...args),
    debug: (message: string, ...args: any[]) => logger.debug(message, ...args)
  };
} 