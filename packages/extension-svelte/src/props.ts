import { TemplateError } from '@js-template-engine/core';
import {
  isIdentifier,
  optionalPropType,
  propAliases,
  propDocumentation,
} from '@js-template-engine/core/emitter';
import type { JsonValue, PropDefinition } from '@js-template-engine/types';

import { quoteSingle, serializeJavaScriptValue } from './literals';

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
 *
 * A prop named by a reserved word (`for`, `class`) is declared under its
 * alias and exported under its name, as the passthrough `class` is:
 * `let forProp: string | undefined = undefined;` then
 * `export { forProp as for };`. A name that is not an identifier
 * (`aria-pressed`) cannot be exported from a legacy component - Svelte
 * compiles `export { ariaPressed as 'aria-pressed' }` but never sets it - so
 * it is a processing error that points to runes mode.
 *
 * @param declaredProps - The component's declared props, in authored order.
 * @param aliases - The alias of each prop whose name is not bindable
 *   ({@link propAliases} over the whole component).
 * @param propPaths - The template path of each prop, for the error
 *   (`props.<name>` when absent).
 */
export function exportLetDeclarations(
  declaredProps: Record<string, PropDefinition>,
  aliases: ReadonlyMap<string, string> = propAliases(
    Object.keys(declaredProps)
  ),
  propPaths: ReadonlyMap<string, string> = new Map()
): string | undefined {
  const entries = Object.entries(declaredProps);
  if (entries.length === 0) {
    return undefined;
  }

  const lines = entries.map(([name, definition]) => {
    const serializedDefault =
      definition.default === undefined
        ? undefined
        : serializeJavaScriptValue(definition.default as JsonValue);
    return [
      ...propDocumentation(definition, '', serializedDefault),
      declaration(name, definition),
    ].join('\n');
  });

  function declaration(name: string, definition: PropDefinition): string {
    const alias = aliases.get(name);
    if (alias !== undefined && !isIdentifier(name)) {
      throw new TemplateError(
        `Legacy Svelte cannot declare a prop named '${name}': a legacy component exports a prop under an identifier only. ` +
          `Build the svelte target in runes mode (svelte({ mode: 'runes' }), --svelte-mode runes, or svelte: { mode: 'runes' } in a kit's configuration), ` +
          `which reads it as '${alias}', or rename the prop`,
        propPaths.get(name) ?? `props.${name}`
      );
    }
    if (name === 'default') {
      // A component module cannot have a default export, so no `export { x
      // as default }` can declare the prop.
      throw new TemplateError(
        `Legacy Svelte cannot declare a prop named 'default': a legacy component exports its props from its module, which may have no default export. ` +
          `Build the svelte target in runes mode (svelte({ mode: 'runes' }), --svelte-mode runes, or svelte: { mode: 'runes' } in a kit's configuration), ` +
          `which reads it as '${alias}', or rename the prop`,
        propPaths.get(name) ?? `props.${name}`
      );
    }
    const local = alias ?? name;
    const exported = alias === undefined ? 'export let' : 'let';
    const exportLine =
      alias === undefined ? '' : `\nexport { ${alias} as ${name} };`;
    if (definition.default !== undefined) {
      const value = serializeJavaScriptValue(definition.default as JsonValue);
      return `${exported} ${local}: ${definition.type} = ${value};${exportLine}`;
    }
    if (definition.required === true) {
      return `${exported} ${local}: ${definition.type};${exportLine}`;
    }
    // Widen an optional prop's type with `| undefined`, unless it already
    // admits `undefined` (avoid a doubled `boolean | undefined | undefined`);
    // a function or conditional type is parenthesized first.
    return `${exported} ${local}: ${optionalPropType(definition.type)} = undefined;${exportLine}`;
  }

  return lines.join('\n');
}

/**
 * Renders the surface-contract declarations for a passthrough root: the
 * consumer `class` (bound through the reserved-word alias), `style`, and a
 * bindable `element` DOM handle. Every legacy `export let` is bindable, so a
 * consumer reaches the root element with `<Name bind:element={el} />`.
 *
 * @param elementType - The type of the root element `element` binds.
 */
export function passthroughDeclarations(elementType: string): string {
  return [
    'let className: string | undefined = undefined;',
    'export { className as class };',
    'export let style: string | undefined = undefined;',
    `export let element: ${elementType} | undefined = undefined;`,
  ].join('\n');
}

/**
 * The reactive statement a legacy component with named slots reads its
 * consumer attributes through. A Svelte 5 consumer's snippet fills a named
 * slot through a prop of that name, and the compiler leaves it in
 * `$$restProps`; spread onto an element, a function under a name the element
 * has a property for (`title`, `hidden`) is written to it. A value under a
 * slot's name that is not a function is the consumer's attribute and stays,
 * and the copy keeps symbol keys, which carry a consumer's attachments.
 *
 * @param slotNames - The component's named slots.
 * @returns The `$:` statement declaring `restProperties`.
 * @example
 * restWithoutSlotContentStatement(['title']);
 */
export function restWithoutSlotContentStatement(
  slotNames: readonly string[]
): string {
  const names = slotNames.map((name) => quoteSingle(name)).join(', ');
  return [
    '$: restProperties = ((rest: Record<string | symbol, any>) => {',
    `  for (const name of [${names}]) {`,
    "    if (typeof rest[name] === 'function') delete rest[name];",
    '  }',
    '  return rest;',
    '})({ ...$$restProps });',
  ].join('\n');
}
