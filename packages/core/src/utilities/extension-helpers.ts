import type { Component } from '@js-template-engine/types';

/**
 * Determines if a component has options for a specific extension key.
 *
 * @param component - The component to check for extension options.
 * @param extensionKey - The extension key to look for.
 * @returns True if the extension options exist on the component, otherwise false.
 */
export function hasExtensionOptions<T extends string = string>(
  component: Component | undefined,
  extensionKey: T
): boolean {
  return !!(component?.extensions && extensionKey in component.extensions);
}

/**
 * Retrieves and casts the options for a specific extension key from a component.
 *
 * @param component - The component to retrieve extension options from.
 * @param extensionKey - The extension key to retrieve.
 * @returns The extension options if present, otherwise undefined.
 */
export function getExtensionOptions<T = unknown>(
  component: Component | undefined,
  extensionKey: string
): T | undefined {
  return component?.extensions?.[extensionKey] as T | undefined;
}

/**
 * Creates a helper object with bound component context for extension operations.
 *
 * @param component - The component to bind for extension operations.
 * @returns An object with `has` and `get` methods for extension options.
 */
export function createComponentHelpers(component: Component | undefined) {
  return {
    /**
     * Checks if the component has options for a specific extension key.
     * @param extensionKey - The extension key to check for.
     * @returns True if the extension options exist, otherwise false.
     */
    has<T extends string = string>(extensionKey: T): boolean {
      return !!(component?.extensions && extensionKey in component.extensions);
    },
    /**
     * Retrieves the options for a specific extension key.
     * @param extensionKey - The extension key to retrieve.
     * @returns The extension options if present, otherwise undefined.
     */
    get<T = unknown>(extensionKey: string): T | undefined {
      return component?.extensions?.[extensionKey] as T | undefined;
    },
  };
}
