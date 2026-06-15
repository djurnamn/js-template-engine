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
 * Renders the `defineProps` macro call, wrapping it in `withDefaults` when
 * any prop declares a default. Returns `undefined` when no props are
 * declared.
 *
 * - no defaults: `defineProps<NameProps>();`
 * - with defaults: `withDefaults(defineProps<NameProps>(), { ... });`
 */
export function definePropsStatement(
  componentName: string,
  declaredProps: Record<string, PropDefinition>
): string | undefined {
  if (Object.keys(declaredProps).length === 0) {
    return undefined;
  }

  const call = `defineProps<${componentName}Props>()`;
  const defaults = Object.entries(declaredProps).filter(
    ([, definition]) => definition.default !== undefined
  );
  if (defaults.length === 0) {
    return `${call};`;
  }

  const entries = defaults.map(
    ([name, definition]) =>
      `  ${name}: ${serializeJavaScriptValue(definition.default as JsonValue)},`
  );
  return `withDefaults(${call}, {\n${entries.join('\n')}\n});`;
}
