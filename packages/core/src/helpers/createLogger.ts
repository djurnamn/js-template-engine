import type { Logger } from '@js-template-engine/types';

export function createLogger(verbose: boolean, context: string): Logger {
  const logger: Logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    success: () => {},
  };

  if (verbose) {
    const methods: (keyof Logger)[] = ['info', 'warn', 'error', 'success'];
    methods.forEach(method => {
      logger[method] = (message: string) => {
        console[method === 'success' ? 'log' : method](`[${context}] ${message}`);
      };
    });
  }

  return logger;
} 