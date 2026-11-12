/** The name of the generated helper that combines a surface's spread records with the consumer's attributes. */
export const CONSUMER_AND_SPREAD = 'consumerAndSpread';

/** The name a component binds the combined record to on its surface root. */
export const CONSUMER_AND_SPREAD_BINDING = 'restAndSpread';

/** How one target spells what the helper merges. */
export interface ConsumerAndSpreadSpelling {
  /** The class attribute's key: `className` in React, `class` in Svelte. */
  classKey: string;
  /** What a style holds: an object in React, CSS text in Svelte. */
  style: 'object' | 'text';
  /** The pattern a handler key matches: `on` and a capital in React, `on` and a lowercase letter in Svelte. */
  handlerPattern: string;
}

/**
 * The generated helper a scripted target declares beside a component whose
 * passthrough surface root also spreads a named record (`$spread`): it folds
 * each record into the consumer's attributes as Vue's `mergeProps` does, so
 * every target combines them alike. Classes join, the consumer's first. Styles
 * merge, the record's declarations winning where both set one. A handler both
 * carry runs both, the consumer's first. A record's class, style or handler
 * that is `undefined` or `null` leaves the consumer's in place. Every other
 * key the record gives wins.
 *
 * @param spelling - How the target spells the class, the style and handlers.
 * @returns The TypeScript function declaration.
 * @example
 * // const restAndSpread = consumerAndSpread({ ...rest, className, style }, extraProps);
 */
export function consumerAndSpreadDeclaration(
  spelling: ConsumerAndSpreadSpelling
): string {
  const styleMerge =
    spelling.style === 'object'
      ? "        merged[key] = typeof current === 'object' && current !== null && typeof value === 'object' ? { ...current, ...value } : value;"
      : "        merged[key] = typeof current === 'string' && current !== '' && typeof value === 'string' ? `${current}; ${value}` : value;";
  return [
    `function ${CONSUMER_AND_SPREAD}<Consumer extends object>(consumer: Consumer, ...records: unknown[]): Consumer {`,
    '  const merged: Record<string, unknown> = { ...(consumer as Record<string, unknown>) };',
    '  for (const record of records) {',
    "    if (typeof record !== 'object' || record === null) continue;",
    '    for (const [key, value] of Object.entries(record)) {',
    '      const current = merged[key];',
    `      const merges = key === '${spelling.classKey}' || key === 'style' || ${spelling.handlerPattern}.test(key);`,
    '      if (merges && (value === undefined || value === null)) continue;',
    `      if (key === '${spelling.classKey}') {`,
    "        merged[key] = [current, value].filter(Boolean).join(' ');",
    "      } else if (key === 'style') {",
    styleMerge,
    "      } else if (merges && typeof current === 'function' && typeof value === 'function') {",
    '        merged[key] = (...parameters: unknown[]) => {',
    '          current(...parameters);',
    '          value(...parameters);',
    '        };',
    '      } else {',
    '        merged[key] = value;',
    '      }',
    '    }',
    '  }',
    '  return merged as Consumer;',
    '}',
  ].join('\n');
}
