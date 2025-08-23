import type { BaseExtensionOptions } from '@js-template-engine/types';

/**
 * Options for configuring the Tailwind extension.
 */
export interface TailwindExtensionOptions extends BaseExtensionOptions {
  /** Output strategy for Tailwind classes */
  outputStrategy: 'css' | 'scss-apply' | 'pass-through';
  /** Tailwind config path or object */
  config?: string | object;
  /** Custom responsive breakpoints */
  breakpoints?: Record<string, string>;
  /** How to handle unknown classes */
  unknownClassHandling: 'warn' | 'error' | 'ignore';
  /** Fallback strategy for non-matching CSS */
  cssFallback: 'inline' | 'custom-class' | 'ignore';
  /** Custom class prefix for fallbacks */
  customClassPrefix?: string;
}

/**
 * Node-level Tailwind extension options.
 */
export interface TailwindNodeExtensions {
  /** Tailwind utility classes */
  class?: string | string[];
  /** Responsive variants */
  responsive?: Record<string, string | string[]>;
  /** Pseudo-class variants */
  variants?: Record<string, string | string[]>;
}

/**
 * Parsed Tailwind utility class.
 */
export interface ParsedUtility {
  /** Base utility class (e.g., 'bg-blue-500') */
  base: string;
  /** Responsive breakpoint (e.g., 'md') */
  responsive?: string;
  /** Pseudo-class variants (e.g., ['hover', 'focus']) */
  variants: string[];
  /** Full original class name */
  original: string;
}

/**
 * Utility validation result.
 */
export interface ValidationResult {
  /** Whether the utility is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** CSS properties this utility affects */
  properties?: string[];
}

/**
 * CSS generation options.
 */
export interface CssGenerationOptions {
  /** Output format */
  format: 'css' | 'scss-apply' | 'pass-through';
  /** Custom breakpoints */
  breakpoints?: Record<string, string>;
  /** Class selector prefix */
  classPrefix?: string;
}