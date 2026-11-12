import type { NestedStyleObject } from '@js-template-engine/types';

import {
  COMPOSED_BOX_SHADOW,
  FONT_VARIANT_NUMERIC,
  OUTLINE_STYLE_REFERENCE,
} from './utilities';

/** One custom property Tailwind v4 registers with `@property`. */
interface RegisteredProperty {
  name: string;
  syntax: string;
  initialValue?: string;
}

/**
 * A set of custom properties Tailwind v4 registers together, and the test
 * telling whether a converted style object uses them: Tailwind registers a
 * group whenever a utility that reads it is in its stylesheet.
 */
interface RegisteredGroup {
  properties: readonly RegisteredProperty[];
  usedBy: (property: string, value: string) => boolean;
}

const ANY = '"*"';
const NO_SHADOW = '0 0 #0000';

/**
 * The groups in the order Tailwind v4 emits them when one rule uses
 * several, each with the registrations exactly as Tailwind v4 writes
 * them.
 */
const REGISTERED_GROUPS: readonly RegisteredGroup[] = [
  {
    // The numeric variants composing `font-variant-numeric`.
    properties: [
      '--tw-ordinal',
      '--tw-slashed-zero',
      '--tw-numeric-figure',
      '--tw-numeric-spacing',
      '--tw-numeric-fraction',
    ].map((name) => ({ name, syntax: ANY })),
    usedBy: (property, value) =>
      property === 'fontVariantNumeric' && value === FONT_VARIANT_NUMERIC,
  },
  {
    // Shadows and rings composing `box-shadow`.
    properties: [
      { name: '--tw-shadow', syntax: ANY, initialValue: NO_SHADOW },
      { name: '--tw-shadow-color', syntax: ANY },
      {
        name: '--tw-shadow-alpha',
        syntax: '"<percentage>"',
        initialValue: '100%',
      },
      { name: '--tw-inset-shadow', syntax: ANY, initialValue: NO_SHADOW },
      { name: '--tw-inset-shadow-color', syntax: ANY },
      {
        name: '--tw-inset-shadow-alpha',
        syntax: '"<percentage>"',
        initialValue: '100%',
      },
      { name: '--tw-ring-color', syntax: ANY },
      { name: '--tw-ring-shadow', syntax: ANY, initialValue: NO_SHADOW },
      { name: '--tw-inset-ring-color', syntax: ANY },
      { name: '--tw-inset-ring-shadow', syntax: ANY, initialValue: NO_SHADOW },
      { name: '--tw-ring-inset', syntax: ANY },
      {
        name: '--tw-ring-offset-width',
        syntax: '"<length>"',
        initialValue: '0px',
      },
      { name: '--tw-ring-offset-color', syntax: ANY, initialValue: '#fff' },
      {
        name: '--tw-ring-offset-shadow',
        syntax: ANY,
        initialValue: NO_SHADOW,
      },
    ],
    usedBy: (property, value) =>
      (property === 'boxShadow' && value === COMPOSED_BOX_SHADOW) ||
      property === '--tw-ring-inset' ||
      property === '--tw-shadow-color',
  },
  {
    // An outline width reading the outline style.
    properties: [
      { name: '--tw-outline-style', syntax: ANY, initialValue: 'solid' },
    ],
    usedBy: (property, value) =>
      property === 'outlineStyle' && value === OUTLINE_STYLE_REFERENCE,
  },
];

/**
 * The `@property` rules Tailwind v4 emits for the converted styles of one
 * component, as Tailwind v4 writes them: a group of registrations
 * for each set of composed custom properties a converted utility uses,
 * the shadow and ring group for `shadow-*` (shadow colors included), ring
 * and inset ring widths and `ring-inset`,
 * the numeric-variant group for `tabular-nums` and its kin, and
 * `--tw-outline-style` for an outline width, each group where the rules
 * first use it, as Tailwind orders them. Registered properties do not
 * inherit, so a ring on a card does not reach a shadowed button inside it,
 * and each starts at its initial value. `undefined` when no converted
 * style uses one.
 *
 * @param styles - The style objects converted for a component's elements.
 * @returns The rules, separated by blank lines, or `undefined`.
 * @example
 * registeredPropertyRules([{ outlineStyle: 'var(--tw-outline-style, solid)' }]);
 * // '@property --tw-outline-style {\n  syntax: "*";\n  inherits: false;\n  initial-value: solid;\n}'
 */
export function registeredPropertyRules(
  styles: readonly NestedStyleObject[]
): string | undefined {
  const groups: RegisteredGroup[] = [];
  for (const style of styles) {
    collectGroups(style, groups);
  }
  if (groups.length === 0) {
    return undefined;
  }
  return groups
    .flatMap((group) => group.properties)
    .map(
      ({ name, syntax, initialValue }) =>
        `@property ${name} {\n  syntax: ${syntax};\n  inherits: false;${
          initialValue === undefined
            ? ''
            : `\n  initial-value: ${initialValue};`
        }\n}`
    )
    .join('\n\n');
}

/**
 * Adds the groups a style object uses to `groups`, in the order its rules
 * emit - a block's own declarations, then its nested blocks in order - and
 * in Tailwind's group order within one rule, which is the order Tailwind's
 * stylesheet first uses them in.
 */
function collectGroups(
  style: NestedStyleObject,
  groups: RegisteredGroup[]
): void {
  const entries = Object.entries(style);
  for (const group of REGISTERED_GROUPS) {
    if (
      !groups.includes(group) &&
      entries.some(
        ([property, value]) =>
          typeof value === 'string' &&
          group.usedBy(property, value.replace(/ !important$/, ''))
      )
    ) {
      groups.push(group);
    }
  }
  for (const [, value] of entries) {
    if (typeof value === 'object' && value !== null) {
      collectGroups(value as NestedStyleObject, groups);
    }
  }
}
