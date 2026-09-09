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
 * Whether a prop's TypeScript type includes a Boolean-casting union member,
 * for the purposes of Vue's Boolean prop casting: the `boolean` keyword or a
 * literal `false`/`true` member. Vue's type-based `defineProps` resolves any
 * of these to a runtime types array containing `Boolean` (`boolean | string`
 * and `false | 'default'` both become `[Boolean, String]`), which sets the
 * Boolean-cast flag - so the absent prop is cast to `false` exactly as for a
 * pure `boolean` prop. Matching is textual on the authored type string: any
 * `|`-split member that is exactly `boolean`, `false`, or `true`. A quoted
 * `'false'`/`'true'` string literal stays unmatched (Vue resolves it to
 * `String` - no cast), as does a member nested inside a generic or
 * parenthesized type (`Array<boolean | string>` splits into fragments that
 * never equal a casting member, and Vue resolves the outer type without the
 * Boolean flag). A named type alias that expands to a boolean-containing
 * union is not visible in the type string and stays unmatched: an author
 * using one declares the `undefined` default explicitly.
 */
const BOOLEAN_CASTING_MEMBERS = new Set(['boolean', 'false', 'true']);

function includesBooleanType(type: string): boolean {
  return type.split('|').some((part) => BOOLEAN_CASTING_MEMBERS.has(part.trim()));
}

/**
 * Renders the `defineProps` macro call, wrapping it in `withDefaults` when any
 * prop declares a default or needs an explicit `undefined` default. Returns
 * `undefined` when no props are declared.
 *
 * - no defaults: `defineProps<NameProps>();`
 * - with defaults: `withDefaults(defineProps<NameProps>(), { ... });`
 *
 * An optional prop whose type includes a Boolean-casting member (pure
 * `boolean`, a `boolean` union member as in `boolean | string`, or a literal
 * `false`/`true` member as in `false | 'default'`) and that declares no
 * default is emitted with an explicit `undefined` default. Without it, Vue's Boolean casting
 * coerces the absent prop to `false`, diverging from React and Svelte (where
 * an absent optional prop is `undefined`); declaring any default - even
 * `undefined` - opts the prop out of the cast, restoring cross-target parity.
 * This matters for a controlled/uncontrolled sentinel prop, where
 * `value === undefined` is semantically distinct from `false`.
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
    } else if (
      definition.required !== true &&
      includesBooleanType(definition.type)
    ) {
      entries.push(`  ${name}: undefined,`);
    }
  }
  if (entries.length === 0) {
    return `${call};`;
  }
  return `withDefaults(${call}, {\n${entries.join('\n')}\n});`;
}
