import type { ExtendedTemplate } from '@js-template-engine/types';

export function getExtensionOptions<T>(
  component: ExtendedTemplate['component'] | undefined,
  extensionKey: string
): T | undefined {
  return component?.extensions?.[extensionKey] as T | undefined;
}

export function hasExtensionOptions(
  component: ExtendedTemplate['component'] | undefined,
  extensionKey: string
): boolean {
  return component?.extensions?.[extensionKey] !== undefined;
} 