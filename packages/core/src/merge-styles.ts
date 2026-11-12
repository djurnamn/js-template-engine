import type {
  NestedSelectorBlock,
  NestedStyleObject,
} from '@js-template-engine/types';

import { isExpressionBinding } from './expression-binding';
import { isSelfKey, toKebabCaseProperty } from './html/styles';

type StyleValue = NestedStyleObject[string];

/**
 * Merges two nested style objects, the override winning conflicts.
 *
 * Plain properties are compared by their kebab-case form, so a camelCase
 * key and its kebab-case spelling address the same property; selector and
 * at-rule keys are compared verbatim. When both sides carry a nested
 * selector block under the same key, the blocks merge recursively;
 * everything else is replaced by the override's value (and key spelling).
 * Base-only entries keep their authored order, followed by override-only
 * entries in theirs.
 */
export function mergeStyleObjects(
  base: NestedStyleObject,
  override: NestedStyleObject
): NestedStyleObject {
  const entries: Array<[string, StyleValue]> = Object.entries(base).filter(
    ([, value]) => value !== undefined
  );
  const indexByCanonicalKey = new Map<string, number>();
  entries.forEach(([key], index) => {
    indexByCanonicalKey.set(canonicalStyleKey(key), index);
  });

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }
    const canonicalKey = canonicalStyleKey(key);
    const existingIndex = indexByCanonicalKey.get(canonicalKey);
    if (existingIndex === undefined) {
      indexByCanonicalKey.set(canonicalKey, entries.length);
      entries.push([key, value]);
      continue;
    }
    const baseValue = entries[existingIndex][1];
    if (isSelectorBlock(baseValue) && isSelectorBlock(value)) {
      entries[existingIndex] = [
        key,
        mergeStyleObjects(baseValue, value) as StyleValue,
      ];
    } else {
      entries[existingIndex] = [key, value];
    }
  }

  return Object.fromEntries(entries);
}

/**
 * Layers a node's authored style over the style styling extensions
 * contributed for it, with three guarantees on the emitted order:
 *
 * 1. Contributed entries keep their order relative to each other.
 * 2. Authored entries keep their order relative to each other, at every
 *    depth: declarations among declarations, nested blocks among nested
 *    blocks (a block's declarations always emit as one rule ahead of its
 *    nested blocks).
 * 3. An authored declaration comes after every contributed declaration of
 *    the same rule, so it wins whatever it overrides there, shorthands
 *    included.
 *
 * An authored declaration replaces a contributed one of the same property
 * in place when no authored declaration and no contributed declaration of
 * the same property family follows it; otherwise the contributed one is
 * dropped and the authored one appended. An authored nested block sharing
 * its key with a contributed one merges into it, recursively, when no
 * authored block placed earlier sits after it, and then keeps the
 * contributed block's position: a later contributed rule of equal
 * specificity still follows it. Otherwise the contributed block stays
 * where it is and the authored block, with every authored block after it,
 * is emitted after the contributed blocks as a second rule for the same
 * selector, under a `&` key standing for the selector itself.
 *
 * @param contributed - The style the styling extensions contributed.
 * @param authored - The node's authored style, which wins conflicts.
 * @returns The layered style object.
 * @example
 * layerStyleObjects(
 *   { '.dark &': { color: 'white' } },
 *   { '&[open]': { color: 'red' }, '.dark &': { margin: '0' } }
 * );
 * // { '.dark &': { color: 'white' }, '&[open]': { color: 'red' },
 * //   '&': { '.dark &': { margin: '0' } } }
 */
export function layerStyleObjects(
  contributed: NestedStyleObject,
  authored: NestedStyleObject
): NestedStyleObject {
  const entries: Array<[string, StyleValue]> = Object.entries(
    contributed
  ).filter(([, value]) => value !== undefined);
  const authoredEntries = new Set<[string, StyleValue]>();
  const indexOf = (key: string) => {
    const canonicalKey = canonicalStyleKey(key);
    const index = entries.findIndex(
      ([entryKey]) => canonicalStyleKey(entryKey) === canonicalKey
    );
    return index === -1 ? undefined : index;
  };
  const place = (entry: [string, StyleValue], index?: number) => {
    authoredEntries.add(entry);
    if (index === undefined) {
      entries.push(entry);
    } else {
      entries[index] = entry;
    }
  };
  // The authored blocks that must follow every contributed block, emitted
  // as a second rule for the selector.
  let laterBlocks: Array<[string, StyleValue]> | undefined;

  for (const [key, value] of Object.entries(authored)) {
    if (value === undefined) {
      continue;
    }
    const existingIndex = indexOf(key);
    const after =
      existingIndex === undefined ? [] : entries.slice(existingIndex + 1);
    if (!isSelectorBlock(value)) {
      if (existingIndex === undefined) {
        place([key, value]);
        continue;
      }
      // In place only when no authored declaration follows, and no
      // contributed declaration the authored one could interact with.
      const blocked = after.some(
        (entry) =>
          !isSelectorBlock(entry[1]) &&
          (authoredEntries.has(entry) || propertiesInteract(entry[0], key))
      );
      if (blocked) {
        entries.splice(existingIndex, 1);
        place([key, value]);
      } else {
        place([key, value], existingIndex);
      }
      continue;
    }
    if (laterBlocks !== undefined) {
      laterBlocks.push([key, value]);
      continue;
    }
    if (existingIndex === undefined) {
      place([key, value]);
      continue;
    }
    // A later contributed self block (`&`, a second rule for the selector)
    // holding the same key emits after this one: the authored block layers
    // into the last such occurrence, so it follows every contributed rule
    // at its path.
    const laterSelfIndex = lastSelfBlockHolding(entries, key, existingIndex);
    if (laterSelfIndex !== undefined) {
      const selfEntry = entries[laterSelfIndex];
      // Once the self block holds authored content, a later authored key
      // layered into it could land ahead of that content, so it goes to
      // the trailing second rule instead.
      const selfBlocked =
        authoredEntries.has(selfEntry) ||
        entries
          .slice(laterSelfIndex + 1)
          .some(
            (entry) => isSelectorBlock(entry[1]) && authoredEntries.has(entry)
          );
      if (!selfBlocked) {
        place(
          [
            selfEntry[0],
            layerStyleObjects(selfEntry[1] as NestedStyleObject, {
              [key]: value,
            }) as StyleValue,
          ],
          laterSelfIndex
        );
        continue;
      }
      laterBlocks = [[key, value]];
      continue;
    }
    const contributedValue = entries[existingIndex][1];
    const blocked = after.some(
      (entry) => isSelectorBlock(entry[1]) && authoredEntries.has(entry)
    );
    if (isSelectorBlock(contributedValue) && !blocked) {
      place(
        [key, layerStyleObjects(contributedValue, value) as StyleValue],
        existingIndex
      );
      continue;
    }
    laterBlocks = [[key, value]];
  }

  if (laterBlocks !== undefined) {
    entries.push([
      selfKey(entries.map(([key]) => key)),
      Object.fromEntries(laterBlocks) as StyleValue,
    ]);
  }
  return Object.fromEntries(entries);
}

/**
 * The index of the last self block (`&`, `:is(&)`) after `fromIndex` that
 * holds `key`, directly or inside a self block of its own, or `undefined`.
 */
function lastSelfBlockHolding(
  entries: ReadonlyArray<[string, StyleValue]>,
  key: string,
  fromIndex: number
): number | undefined {
  for (let index = entries.length - 1; index > fromIndex; index -= 1) {
    const [entryKey, value] = entries[index];
    if (
      isSelfKey(entryKey) &&
      isSelectorBlock(value) &&
      blockHolds(value, key)
    ) {
      return index;
    }
  }
  return undefined;
}

function blockHolds(block: NestedSelectorBlock, key: string): boolean {
  const canonicalKey = canonicalStyleKey(key);
  return Object.entries(block).some(
    ([entryKey, value]) =>
      value !== undefined &&
      (canonicalStyleKey(entryKey) === canonicalKey ||
        (isSelfKey(entryKey) &&
          isSelectorBlock(value) &&
          blockHolds(value, key)))
  );
}

/**
 * Whether two declarations can affect the same value, so their order in a
 * rule matters: the same property, or two in one family, such as a
 * shorthand and its longhands (`padding`, `padding-left`), or logical and
 * physical properties (`width`, `inline-size`; `inset`, `top`). Errs
 * toward `true`: properties are grouped by their leading word, with the
 * families whose names do not share one listed.
 *
 * @param first - A property name, camelCase or kebab-case.
 * @param second - Another property name.
 * @returns `true` when the order of the two declarations can matter.
 * @example
 * propertiesInteract('padding', 'paddingInline'); // true
 * propertiesInteract('padding', 'color'); // false
 */
export function propertiesInteract(first: string, second: string): boolean {
  const firstName = canonicalStyleKey(first);
  const secondName = canonicalStyleKey(second);
  if (firstName === secondName) {
    return true;
  }
  if (firstName.startsWith('--') || secondName.startsWith('--')) {
    return false;
  }
  if (firstName === 'all' || secondName === 'all') {
    return true;
  }
  return propertyFamily(firstName) === propertyFamily(secondName);
}

const PROPERTY_FAMILIES: Record<string, string> = {
  top: 'inset',
  right: 'inset',
  bottom: 'inset',
  left: 'inset',
  width: 'size',
  height: 'size',
  min: 'size',
  max: 'size',
  inline: 'size',
  block: 'size',
  gap: 'gap',
  'row-gap': 'gap',
  'column-gap': 'gap',
  'grid-gap': 'gap',
  'grid-row-gap': 'gap',
  'grid-column-gap': 'gap',
  column: 'columns',
  // `white-space` and `text-wrap` are both shorthands setting
  // `text-wrap-mode`.
  white: 'text',
  place: 'alignment',
  align: 'alignment',
  justify: 'alignment',
  'line-height': 'font',
  'text-decoration': 'text',
};

function propertyFamily(property: string): string {
  const unprefixed = property.replace(/^-[a-z]+-/, '');
  const full = PROPERTY_FAMILIES[unprefixed];
  if (full !== undefined) {
    return full;
  }
  const word = unprefixed.split('-')[0];
  return PROPERTY_FAMILIES[word] ?? word;
}

/**
 * A nested key standing for the selector itself that no key in `taken`
 * already uses: `&`, else `:is(&)`, which matches the same elements with
 * the same specificity, wrapped further as needed.
 */
function selfKey(taken: readonly string[]): string {
  let key = '&';
  while (taken.includes(key)) {
    key = `:is(${key})`;
  }
  return key;
}

/**
 * The comparison form of a style key: selector and at-rule keys verbatim,
 * plain property names kebab-cased (so `backgroundColor` and
 * `background-color` are one property).
 */
function canonicalStyleKey(key: string): string {
  if (/[@:.[&\s]/.test(key)) {
    return key;
  }
  return toKebabCaseProperty(key);
}

function isSelectorBlock(value: StyleValue): value is NestedSelectorBlock {
  return (
    typeof value === 'object' && value !== null && !isExpressionBinding(value)
  );
}
