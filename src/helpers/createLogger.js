const signale = require("signale");

const createLogger = (verbose = false, prefix = "") => {
  const logger = {};
  const methods = ["info", "warn", "error", "debug", "success"];

  methods.forEach((method) => {
    logger[method] = (...args) => {
      if (verbose) {
        signale[method](prefix ? `[${prefix}]` : "", ...args);
      }
      // If not verbose, do nothing
    };
  });

  return logger;
};

module.exports = createLogger;
