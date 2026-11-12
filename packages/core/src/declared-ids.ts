import type { DeclaredId as DeclaredIdDefinition } from '@js-template-engine/types';

/** A per-instance id a component declares in `ids`. */
export interface DeclaredId {
  /** The name the template, the scripts and derived values read it by. */
  name: string;
  /** The literal start of the generated id. */
  prefix: string;
  /** The string prop whose given value replaces the generated id, if any. */
  prop?: string;
}

/**
 * The name each scripted target declares the component instance's own id
 * under, once, when the component declares any `ids`: React's and Vue's
 * `useId()`, Svelte runes' `$props.id()` or legacy Svelte's counter. Every
 * declared id is its prefix followed by it.
 */
export const GENERATED_ID_NAME = 'generatedId';

/**
 * The module-level function legacy Svelte numbers its instances with, when
 * the component declares any `ids`: {@link nextGeneratedIdDeclaration}.
 */
export const GENERATED_ID_NEXT_NAME = 'nextGeneratedId';

/**
 * The key, read through `Symbol.for`, of the one counter on `globalThis`
 * that every legacy Svelte component declaring `ids` numbers its instances
 * from, so two components on a page never hand out the same number.
 */
export const GENERATED_ID_COUNTER_KEY = 'js-template-engine.generatedId';

/**
 * The declaration of {@link GENERATED_ID_NEXT_NAME} for a module script: a
 * function returning the next number of the page-wide counter.
 *
 * @returns The declaration's lines.
 */
export function nextGeneratedIdDeclaration(): string[] {
  return [
    `function ${GENERATED_ID_NEXT_NAME}(): number {`,
    `  const key = Symbol.for('${GENERATED_ID_COUNTER_KEY}');`,
    '  const page = globalThis as unknown as Record<symbol, number | undefined>;',
    '  const next = (page[key] ?? 0) + 1;',
    '  page[key] = next;',
    '  return next;',
    '}',
  ];
}

/** The pattern a prefix follows: a letter, then letters, digits, `-` or `_`. */
export const ID_PREFIX_PATTERN = /^[A-Za-z][\w-]*$/;

/**
 * A component's declared ids, in declaration order.
 *
 * @param component - The component, or anything carrying its `ids` map.
 * @returns The ids; empty when the component declares none.
 * @example
 * declaredIdsOf({ ids: { listId: 'command', inputId: { prefix: 'field', prop: 'id' } } });
 * // [{ name: 'listId', prefix: 'command' },
 * //  { name: 'inputId', prefix: 'field', prop: 'id' }]
 */
export function declaredIdsOf(component: {
  ids?: Readonly<Record<string, string | DeclaredIdDefinition>>;
}): DeclaredId[] {
  return Object.entries(component.ids ?? {}).map(([name, definition]) =>
    typeof definition === 'string'
      ? { name, prefix: definition }
      : {
          name,
          prefix: definition.prefix,
          ...(definition.prop !== undefined ? { prop: definition.prop } : {}),
        }
  );
}

/**
 * The expression a scripted target computes a declared id with, once the
 * instance's own id is in {@link GENERATED_ID_NAME}: the prefix and the
 * generated id, or the consumer's prop value when it is given.
 *
 * @param id - The declared id.
 * @param propLocal - The name the target reads the id's prop by, for an id
 *   with a `prop`.
 * @returns The expression, as code.
 * @example
 * idExpression({ name: 'inputId', prefix: 'field', prop: 'id' }, 'id');
 * // 'id ?? `field-${generatedId}`'
 */
export function idExpression(id: DeclaredId, propLocal?: string): string {
  const generated = `\`${id.prefix}-\${${GENERATED_ID_NAME}}\``;
  return id.prop === undefined || propLocal === undefined
    ? generated
    : `${propLocal} ?? ${generated}`;
}

/**
 * Hands out the values a declared id takes at rest, `prefix-1`, `prefix-2`
 * and so on, counted per prefix through one rendered page, so each instance
 * on the page gets its own.
 */
export class RestIdCounter {
  private readonly counts = new Map<string, number>();

  /**
   * The next value for a prefix.
   *
   * @param prefix - The id's prefix.
   * @returns `prefix-N`, N one more than the last for the prefix.
   */
  next(prefix: string): string {
    const count = (this.counts.get(prefix) ?? 0) + 1;
    this.counts.set(prefix, count);
    return `${prefix}-${count}`;
  }
}

/**
 * The comment the html target writes at a component's head for each declared id,
 * saying what the name the markup reads is: `listId = 'command-1' (an id per
 * instance)`, and for an id with a prop, `inputId = id ?? 'field-1' (an id
 * per instance)`.
 *
 * @param id - The declared id.
 * @param value - The value it takes at rest.
 * @returns The comment's text.
 */
export function idComment(id: DeclaredId, value: string): string {
  const quoted = `'${value}'`;
  return `${id.name} = ${id.prop === undefined ? quoted : `${id.prop} ?? ${quoted}`} (an id per instance)`;
}
