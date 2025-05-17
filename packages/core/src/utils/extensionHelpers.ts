import type { Component } from '@js-template-engine/types';

/**
 * Type guard for checking if an extension has options in the component.
 */
export function hasExtensionOptions<T extends string = string>(
  component: Component | undefined,
  key: T
): boolean {
  return !!(component?.extensions && key in component.extensions);
}

/**
 * Retrieves and casts the options for a specific extension key.
 * Returns undefined if not present.
 */
export function getExtensionOptions<T = unknown>(
  component: Component | undefined,
  key: string
): T | undefined {
  return component?.extensions?.[key] as T | undefined;
}

/**
 * Creates a helper object with bound component context for extension operations.
 */
export function createComponentHelpers(component: Component | undefined) {
  return {
    has<T extends string = string>(key: T): boolean {
      return !!(component?.extensions && key in component.extensions);
    },
    get<T = unknown>(key: string): T | undefined {
      return component?.extensions?.[key] as T | undefined;
    }
  };
} 