import type { JsonValue, PropDefinition } from '@js-template-engine/types';

import { serializeJavaScriptValue } from './literals';

/**
 * Whether a TypeScript type expression already admits `undefined` as a union
 * member, so widening an optional prop's type would double it.
 */
function typeAdmitsUndefined(type: string): boolean {
  return type
    .split('|')
    .map((part) => part.trim())
    .includes('undefined');
}

/**
 * Renders the component's props as Svelte `export let` declarations, in
 * authored order. Returns `undefined` when no props are declared.
 *
 * - with a default: `export let size: number = 48;`
 * - required, no default: `export let imageUrl: string;`
 * - optional, no default: `export let label: string | undefined = undefined;`
 *
 * Unlike React, Svelte slots are template `<slot>` elements rather than
 * props, so only the author's declared props appear here.
 */
export function exportLetDeclarations(
  declaredProps: Record<string, PropDefinition>
): string | undefined {
  const entries = Object.entries(declaredProps);
  if (entries.length === 0) {
    return undefined;
  }

  const lines = entries.map(([name, definition]) => {
    if (definition.default !== undefined) {
      const value = serializeJavaScriptValue(definition.default as JsonValue);
      return `export let ${name}: ${definition.type} = ${value};`;
    }
    if (definition.required === true) {
      return `export let ${name}: ${definition.type};`;
    }
    // Widen an optional prop's type with `| undefined`, unless it already
    // admits `undefined` (avoid a doubled `boolean | undefined | undefined`).
    const optionalType = typeAdmitsUndefined(definition.type)
      ? definition.type
      : `${definition.type} | undefined`;
    return `export let ${name}: ${optionalType} = undefined;`;
  });

  return lines.join('\n');
}

/**
 * Renders the surface-contract declarations for a passthrough root: the
 * consumer `class` (bound through the reserved-word alias), `style`, and a
 * bindable `element` DOM handle. Every legacy `export let` is bindable, so a
 * consumer reaches the root element with `<Name bind:element={el} />`.
 */
export function passthroughDeclarations(): string {
  return [
    'let className: string | undefined = undefined;',
    'export { className as class };',
    'export let style: string | undefined = undefined;',
    'export let element: HTMLElement | undefined = undefined;',
  ].join('\n');
}
