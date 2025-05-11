"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = void 0;
const signale_1 = __importDefault(require("signale"));
const createLogger = (verbose = false, prefix = '') => {
    const logger = {
        info: () => { },
        warn: () => { },
        error: () => { },
        success: () => { },
    };
    const methods = ['info', 'warn', 'error', 'success'];
    methods.forEach((method) => {
        logger[method] = (...args) => {
            if (verbose) {
                signale_1.default[method](prefix ? `[${prefix}]` : '', ...args);
            }
            // If not verbose, do nothing
        };
    });
    return logger;
};
exports.createLogger = createLogger;
