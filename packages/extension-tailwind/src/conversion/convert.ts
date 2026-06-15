import { mergeStyleObjects } from '@js-template-engine/core';
import type {
  NestedSelectorBlock,
  NestedStyleObject,
} from '@js-template-engine/types';

import { splitCandidate } from './parse';
import { resolveBaseUtility, type Declarations } from './utilities';
import { resolveVariant, type ConversionFail } from './variants';

/**
 * Converts Tailwind utility classes into one nested style object.
 *
 * Utilities resolve against the bundled Tailwind v4 default theme and apply
 * in declared order, later declarations winning property conflicts; variant
 * prefixes become nested pseudo-selector and at-rule blocks, the leftmost
 * variant outermost. A utility that cannot be converted — unknown, outside
 * the supported subset, or carrying an unsupported value — raises a
 * processing error through `fail`.
 */
export function convertUtilityClasses(
  classes: readonly string[],
  fail: ConversionFail
): NestedStyleObject {
  let merged: NestedStyleObject = {};
  for (const candidate of classes) {
    merged = mergeStyleObjects(merged, convertCandidate(candidate, fail));
  }
  return merged;
}

function convertCandidate(
  candidate: string,
  fail: ConversionFail
): NestedStyleObject {
  const { variants, base } = splitCandidate(candidate);
  const { declarations, important } = resolveBaseUtility(
    base,
    candidate,
    fail
  );

  let result: NestedSelectorBlock = important
    ? markImportant(declarations)
    : declarations;

  for (let index = variants.length - 1; index >= 0; index -= 1) {
    const wrappers = resolveVariant(variants[index], candidate, fail);
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
