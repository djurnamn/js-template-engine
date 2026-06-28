import type { JsonValue, PropDefinition } from '@js-template-engine/types';

import { serializeJavaScriptValue } from './literals';

/**
 * Renders the generated props interface for a Vue component, declared
 * props in authored order. Returns `undefined` when no props are declared.
 *
 * Unlike React, Vue slots are template `<slot>` elements rather than
 * props, so the interface carries only the author's declared props.
 */
export function propsInterface(
  componentName: string,
  declaredProps: Record<string, PropDefinition>
): string | undefined {
  const entries = Object.entries(declaredProps).map(([name, definition]) => {
    const optionalMarker = definition.required === true ? '' : '?';
    return `  ${name}${optionalMarker}: ${definition.type};`;
  });
  if (entries.length === 0) {
    return undefined;
  }
  return `interface ${componentName}Props {\n${entries.join('\n')}\n}`;
}

/**
 * Whether a prop's TypeScript type is `boolean` for the purposes of Vue's
 * Boolean prop casting - `boolean`, or `boolean` unioned only with `undefined`
 * and/or `null` (`boolean | undefined`). A union with any other member
 * (`boolean | 'auto'`), or a named type, is deliberately **not** matched: the
 * engine sees only the type string and cannot reason about Vue's runtime cast
 * for those, so it stays conservative and leaves them to the author.
 */
function isBooleanType(type: string): boolean {
  const remainder = type
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== 'undefined' && part !== 'null');
  return remainder.length === 1 && remainder[0] === 'boolean';
}

/**
 * Renders the `defineProps` macro call, wrapping it in `withDefaults` when any
 * prop declares a default or needs an explicit `undefined` default. Returns
 * `undefined` when no props are declared.
 *
 * - no defaults: `defineProps<NameProps>();`
 * - with defaults: `withDefaults(defineProps<NameProps>(), { ... });`
 *
 * An optional `boolean` prop with no declared default is emitted with an
 * explicit `undefined` default. Without it, Vue's Boolean casting coerces the
 * absent prop to `false`, diverging from React and Svelte (where an absent
 * optional prop is `undefined`); declaring any default - even `undefined` - 
 * opts the prop out of the cast, restoring cross-target parity. This matters
 * for a controlled/uncontrolled sentinel prop, where `value === undefined` is
 * semantically distinct from `false`.
 */
export function definePropsStatement(
  componentName: string,
  declaredProps: Record<string, PropDefinition>
): string | undefined {
  if (Object.keys(declaredProps).length === 0) {
    return undefined;
  }

  const call = `defineProps<${componentName}Props>()`;
  const entries: string[] = [];
  for (const [name, definition] of Object.entries(declaredProps)) {
    if (definition.default !== undefined) {
      entries.push(
        `  ${name}: ${serializeJavaScriptValue(definition.default as JsonValue)},`
      );
    } else if (definition.required !== true && isBooleanType(definition.type)) {
      entries.push(`  ${name}: undefined,`);
    }
  }
  if (entries.length === 0) {
    return `${call};`;
  }
  return `withDefaults(${call}, {\n${entries.join('\n')}\n});`;
}
