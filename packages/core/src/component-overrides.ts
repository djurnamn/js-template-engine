import type {
  ComponentExtensionOverride,
  PropDefinition,
} from '@js-template-engine/types';

import type { NormalizedComponent } from './normalize';

/**
 * Applies a component-level extension override block to a component.
 *
 * Looks up `component.extensions[extensionKey]` and combines each field
 * with the base value per its strategy (default `'merge'`):
 *
 * - imports: concatenated with duplicates dropped
 * - script / style: base first, override appended after a blank line
 * - props: object spread, the override winning per key
 *
 * `'replace'` discards the base value. Returns the component unchanged when
 * no override block exists for the extension.
 *
 * @param component - The normalized component.
 * @param extensionKey - The extension's declared name (`'react'`, ...).
 * @returns A component with the override applied.
 */
export function resolveComponentOverrides(
  component: NormalizedComponent,
  extensionKey: string
): NormalizedComponent {
  return applyComponentOverride(
    component,
    component.extensions[extensionKey] as ComponentExtensionOverride | undefined
  );
}

/**
 * Applies one component-level override block to a component, combining each
 * field with the base value per its strategy as
 * {@link resolveComponentOverrides} does. An extension with override blocks
 * of its own beyond the shared one - the Svelte extension's per-mode blocks -
 * applies each in turn on the component the previous one produced.
 *
 * @param component - The normalized component.
 * @param override - The override block; `undefined` leaves the component
 *   unchanged.
 * @returns A component with the override applied.
 *
 * @example
 * applyComponentOverride(resolveComponentOverrides(component, 'svelte'), {
 *   script: 'const doubled = $derived(count * 2);',
 * });
 */
export function applyComponentOverride(
  component: NormalizedComponent,
  override: ComponentExtensionOverride | undefined
): NormalizedComponent {
  if (override === undefined) {
    return component;
  }
  return {
    ...component,
    imports: mergeImports(component.imports, override),
    script: mergeText(
      component.script,
      override.script,
      override.scriptStrategy
    ),
    style: mergeText(component.style, override.style, override.styleStrategy),
    props: mergeProps(component.props, override),
  };
}

function mergeImports(
  base: string[],
  override: ComponentExtensionOverride
): string[] {
  if (override.imports === undefined) {
    return base;
  }
  if (override.importsStrategy === 'replace') {
    return override.imports;
  }
  const merged: string[] = [];
  for (const importStatement of [...base, ...override.imports]) {
    if (!merged.includes(importStatement)) {
      merged.push(importStatement);
    }
  }
  return merged;
}

function mergeText(
  base: string | undefined,
  override: string | undefined,
  strategy: 'replace' | 'merge' | undefined
): string | undefined {
  if (override === undefined) {
    return base;
  }
  if (strategy === 'replace' || base === undefined) {
    return override;
  }
  return `${base}\n\n${override}`;
}

function mergeProps(
  base: Record<string, PropDefinition>,
  override: ComponentExtensionOverride
): Record<string, PropDefinition> {
  if (override.props === undefined) {
    return base;
  }
  if (override.propsStrategy === 'replace') {
    return override.props;
  }
  return { ...base, ...override.props };
}
