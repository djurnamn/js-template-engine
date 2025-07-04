import { Signale } from 'signale';

/**
 * Creates a logger instance with specified verbosity and scope.
 * @param verbose - Whether to enable verbose logging.
 * @param scope - Optional scope identifier for the logger.
 * @returns A logger object with info, success, error, warn, and debug methods.
 */
export function createLogger(verbose = false, scope?: string) {
  const logger = new Signale({
    scope,
    disabled: !verbose,
  });

  return {
    /**
     * Logs an informational message.
     * @param message - The message to log.
     * @param args - Additional arguments to include in the log.
     */
    info: (message: string, ...args: any[]) => logger.info(message, ...args),

    /**
     * Logs a success message.
     * @param message - The message to log.
     * @param args - Additional arguments to include in the log.
     */
    success: (message: string, ...args: any[]) =>
      logger.success(message, ...args),

    /**
     * Logs an error message.
     * @param message - The message to log.
     * @param args - Additional arguments to include in the log.
     */
    error: (message: string, ...args: any[]) => logger.error(message, ...args),

    /**
     * Logs a warning message.
     * @param message - The message to log.
     * @param args - Additional arguments to include in the log.
     */
    warn: (message: string, ...args: any[]) => logger.warn(message, ...args),

    /**
     * Logs a debug message.
     * @param message - The message to log.
     * @param args - Additional arguments to include in the log.
     */
    debug: (message: string, ...args: any[]) => logger.debug(message, ...args),
  };
}
