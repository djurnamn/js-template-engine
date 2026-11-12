import { mergeStyleObjects } from '@js-template-engine/core';
import { propertiesInteract } from '@js-template-engine/core/emitter';
import type {
  NestedSelectorBlock,
  NestedStyleObject,
} from '@js-template-engine/types';

import { splitCandidate } from './parse';
import { resolveBaseUtility, type Declarations } from './utilities';
import {
  compareVariants,
  resolveVariant,
  type ConversionFail,
  type ConversionFailure,
  type VariantOptions,
} from './variants';

/**
 * Converts Tailwind utility classes into one nested style object.
 *
 * Utilities resolve against the bundled Tailwind v4 default theme; variant
 * prefixes become nested pseudo-selector and at-rule blocks, the leftmost
 * variant outermost. The converted rules emit in the order Tailwind v4's
 * stylesheet gives them: sorted by their variants (see
 * {@link compareVariantSets}), so `hover:` rules come before `dark:`
 * rules and a `dark:hover:` rule after both, whatever the class order.
 * Utilities with the same variants keep their declared order, later
 * declarations winning property conflicts. A rule merges into an earlier
 * block of the same key only when no nested block follows that one, so
 * merging never moves it ahead of a rule sorted before it; otherwise it
 * becomes a second rule for that key, nested under a `&` key standing for
 * the selector itself.
 *
 * A utility that cannot be converted - unknown, outside the supported
 * subset, or carrying an unsupported value - is reported through `report`
 * and contributes nothing, and conversion carries on with the next
 * utility, so every unconvertible utility is reported in one run.
 * `options.darkSelector` writes `dark:` under that selector instead of the
 * `prefers-color-scheme` media query.
 */
export function convertUtilityClasses(
  classes: readonly string[],
  report: (message: string) => void,
  options: VariantOptions = {}
): NestedStyleObject {
  const converted: Array<{ variants: string[]; style: NestedStyleObject }> = [];
  for (const candidate of classes) {
    try {
      converted.push({
        variants: splitCandidate(candidate).variants,
        style: convertCandidate(candidate, conversionFail, options),
      });
    } catch (error) {
      if (error instanceof ConversionError) {
        report(error.message);
        continue;
      }
      throw error;
    }
  }
  // Array.prototype.sort is stable, so equal variant sets keep class order.
  converted.sort((first, second) =>
    compareVariantSets(first.variants, second.variants)
  );
  let merged: NestedStyleObject = {};
  for (const { style } of converted) {
    merged = appendInOrder(merged, style);
  }
  return merged;
}

/**
 * Compares two utilities' variants as Tailwind v4 sorts its rules: each
 * set of distinct variants is read from its latest-registered variant
 * down ({@link compareVariants}), and the set whose first differing
 * variant comes later sorts later, a set extending the other one last. No
 * variants sort first, and the order the variants are written in does not
 * matter: `dark:hover:` and `hover:dark:` sort together, after `hover:`
 * and after `dark:`.
 *
 * @param first - One utility's variants, as written.
 * @param second - Another utility's variants.
 * @returns A negative number when `first` sorts first, a positive one
 *   when `second` does, zero for the same set of variants.
 * @example
 * compareVariantSets(['hover'], ['dark', 'hover']); // < 0
 */
export function compareVariantSets(
  first: readonly string[],
  second: readonly string[]
): number {
  const firstDescending = distinctDescending(first);
  const secondDescending = distinctDescending(second);
  const length = Math.min(firstDescending.length, secondDescending.length);
  for (let index = 0; index < length; index += 1) {
    const comparison = compareVariants(
      firstDescending[index],
      secondDescending[index]
    );
    if (comparison !== 0) {
      return comparison;
    }
  }
  return firstDescending.length - secondDescending.length;
}

function distinctDescending(variants: readonly string[]): string[] {
  const sorted = [...variants].sort((first, second) =>
    compareVariants(second, first)
  );
  return sorted.filter(
    (variant, index) =>
      index === 0 || compareVariants(sorted[index - 1], variant) !== 0
  );
}

/**
 * Appends one utility's style after the rules already merged, keeping
 * emitted order. Declarations merge as {@link mergeStyleObjects} merges
 * them. A nested block merges into the block of the same key when no
 * nested block follows that one, or into a trailing `&` block standing for
 * the selector itself; otherwise it is appended under a new `&` key (or
 * `:is(&)` when `&` is taken), a second rule for the same selector that
 * emits after everything before it.
 */
function appendInOrder(
  base: NestedStyleObject,
  addition: NestedStyleObject
): NestedStyleObject {
  let merged = base;
  for (const [key, value] of Object.entries(addition)) {
    if (!isNestedBlock(value)) {
      merged = appendDeclaration(merged, key, value);
      continue;
    }
    const blockKeys = Object.keys(merged).filter((entryKey) =>
      isNestedBlock(merged[entryKey])
    );
    const lastBlockKey = blockKeys[blockKeys.length - 1];
    if (!(key in merged)) {
      if (lastBlockKey !== undefined && isSelfKey(lastBlockKey)) {
        merged = {
          ...merged,
          [lastBlockKey]: appendInOrder(
            merged[lastBlockKey] as NestedStyleObject,
            { [key]: value }
          ) as NestedSelectorBlock,
        };
      } else {
        merged = { ...merged, [key]: value };
      }
      continue;
    }
    if (key === lastBlockKey) {
      merged = {
        ...merged,
        [key]: appendInOrder(
          merged[key] as NestedStyleObject,
          value as NestedStyleObject
        ) as NestedSelectorBlock,
      };
      continue;
    }
    if (isSelfKey(lastBlockKey)) {
      merged = {
        ...merged,
        [lastBlockKey]: appendInOrder(
          merged[lastBlockKey] as NestedStyleObject,
          { [key]: value }
        ) as NestedSelectorBlock,
      };
      continue;
    }
    merged = {
      ...merged,
      [unusedSelfKey(merged)]: { [key]: value } as NestedSelectorBlock,
    };
  }
  return merged;
}

/**
 * Sets one converted declaration so the later utility wins: in place when
 * no declaration it interacts with ({@link propertiesInteract}: the same
 * property, or a shorthand, longhand, logical or physical form of it)
 * follows the one it replaces, otherwise removed and appended, so
 * `px-4 p-2 px-8` ends with `padding-inline` after `padding`.
 */
function appendDeclaration(
  style: NestedStyleObject,
  key: string,
  value: NestedStyleObject[string]
): NestedStyleObject {
  const entries = Object.entries(style);
  const existingIndex = entries.findIndex(
    ([entryKey, entryValue]) =>
      !isNestedBlock(entryValue) && toKebabCase(entryKey) === toKebabCase(key)
  );
  if (existingIndex === -1) {
    return mergeStyleObjects(style, { [key]: value });
  }
  const blocked = entries
    .slice(existingIndex + 1)
    .some(
      ([entryKey, entryValue]) =>
        !isNestedBlock(entryValue) && propertiesInteract(entryKey, key)
    );
  if (!blocked) {
    return mergeStyleObjects(style, { [key]: value });
  }
  entries.splice(existingIndex, 1);
  entries.push([key, value]);
  return Object.fromEntries(entries);
}

function toKebabCase(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function isNestedBlock(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

/** Whether a key is `&`, or `&` wrapped in `:is()`. */
function isSelfKey(key: string): boolean {
  let inner = key;
  while (inner.startsWith(':is(') && inner.endsWith(')')) {
    inner = inner.slice(4, -1);
  }
  return inner === '&';
}

function unusedSelfKey(style: NestedStyleObject): string {
  let key = '&';
  while (key in style) {
    key = `:is(${key})`;
  }
  return key;
}

/**
 * Returns true when a class reads as a Tailwind utility: it converts; it
 * is a utility the conversion knows but leaves out of its subset
 * (`rotate-45`, `has-checked:underline`); or it is a known root with a value
 * outside the default theme, or a Tailwind v4 utility the conversion does
 * not map, that carries a variant or a leading `!`
 * (`data-[state=open]:bg-accent`, `!bg-brand`, `hover:float-left`). A name
 * the conversion does not know, or one of those without a variant or `!`
 * (`content-wrapper`, a theme token such as `bg-primary`, `container`),
 * does not.
 */
export function looksLikeUtilityClass(candidate: string): boolean {
  const important = candidate.startsWith('!');
  const unprefixed = important ? candidate.slice(1) : candidate;
  try {
    convertCandidate(unprefixed, conversionFail);
    return true;
  } catch (error) {
    if (!(error instanceof ConversionError)) {
      throw error;
    }
    if (error.failure === undefined) {
      return true;
    }
    return (
      (error.failure === 'unsupported-value' ||
        error.failure === 'unsupported-utility') &&
      (important || splitCandidate(unprefixed).variants.length > 0)
    );
  }
}

class ConversionError extends Error {
  constructor(
    message: string,
    readonly failure?: ConversionFailure
  ) {
    super(message);
  }
}

const conversionFail: ConversionFail = (message, failure) => {
  throw new ConversionError(message, failure);
};

function convertCandidate(
  candidate: string,
  fail: ConversionFail,
  options: VariantOptions = {}
): NestedStyleObject {
  const { variants, base } = splitCandidate(candidate);
  const { declarations, nested, important } = resolveBaseUtility(
    base,
    candidate,
    fail
  );

  let result: NestedSelectorBlock = important
    ? markImportant(declarations)
    : declarations;
  for (const [atRule, nestedDeclarations] of Object.entries(nested ?? {})) {
    result = {
      ...result,
      [atRule]: important
        ? markImportant(nestedDeclarations)
        : nestedDeclarations,
    };
  }

  for (let index = variants.length - 1; index >= 0; index -= 1) {
    const wrappers = resolveVariant(variants[index], candidate, fail, options);
    for (
      let wrapperIndex = wrappers.length - 1;
      wrapperIndex >= 0;
      wrapperIndex -= 1
    ) {
      result = { [wrappers[wrapperIndex]]: result };
    }
  }
  return result;
}

function markImportant(declarations: Declarations): Declarations {
  return Object.fromEntries(
    Object.entries(declarations).map(([property, value]) => [
      property,
      `${value} !important`,
    ])
  );
}
