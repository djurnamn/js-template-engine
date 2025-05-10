import signale from 'signale';
import { Logger } from '../types';

const createLogger = (verbose = false, prefix = ''): Logger => {
  const logger: Logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    success: () => {},
  };

  const methods: (keyof Logger)[] = ['info', 'warn', 'error', 'success'];

  methods.forEach((method) => {
    logger[method] = (...args: any[]) => {
      if (verbose) {
        signale[method](prefix ? `[${prefix}]` : '', ...args);
      }
      // If not verbose, do nothing
    };
  });

  return logger;
};

export default createLogger; 