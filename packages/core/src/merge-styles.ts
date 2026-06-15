import type {
  NestedSelectorBlock,
  NestedStyleObject,
} from '@js-template-engine/types';

import { isExpressionBinding } from './expression-binding';
import { toKebabCaseProperty } from './html/styles';

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
