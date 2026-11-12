import { visitElements } from '@js-template-engine/core';
import {
  latestValueName,
  ownSetterName,
} from '@js-template-engine/core/emitter';
import type {
  ReservedName,
  ReservedNameContext,
} from '@js-template-engine/types';

import {
  INDETERMINATE_REF_NAME,
  INDETERMINATE_REFS_NAME,
  setsIndeterminateThroughRef,
} from './refs';

/**
 * The names a React component declares itself in its scope, whatever the
 * template: its `props` parameter, the in-file stylesheet, the BEM runtime
 * import, the fragment import, and the routed and undeclared props of a
 * passthrough surface.
 */
const COMPONENT_NAMES: readonly ReservedName[] = [
  { name: 'props', description: "React's component parameter" },
  { name: 'componentStyles', description: "React's in-file stylesheet" },
  { name: 'useBem', description: "React's BEM runtime import" },
  { name: 'Fragment', description: "React's fragment import" },
  { name: 'routedRest', description: "React's routed attributes" },
  { name: 'surfaceProperties', description: "React's undeclared props" },
];

/** The hooks a React component with declared ids imports. */
const ID_NAMES: readonly ReservedName[] = [
  {
    name: 'useId',
    description: "the import React's and Vue's ids use",
    when: 'ids',
  },
  {
    name: 'useState',
    description: "React's import for two-way values",
    when: 'ids',
  },
  {
    name: 'useRef',
    description: "React's import for two-way values",
    when: 'ids',
  },
];

/** The hooks a React component with two-way props imports. */
const TWO_WAY_NAMES: readonly ReservedName[] = [
  {
    name: 'useState',
    description: "React's import for the two-way props",
    when: 'twoWay',
  },
  {
    name: 'useRef',
    description: "React's import for the two-way props",
    when: 'twoWay',
  },
];

/**
 * The helper a React component declares where an `<input>` sets its
 * `indeterminate` through a ref.
 */
const INDETERMINATE_NAMES: readonly ReservedName[] = [
  {
    name: INDETERMINATE_REF_NAME,
    description: "React's indeterminate ref helper",
  },
  {
    name: INDETERMINATE_REFS_NAME,
    description: "React's indeterminate ref callbacks",
  },
];

/**
 * The names a React component declares itself: those of every component,
 * the `indeterminate` ref helper's where an input sets one through it, those its
 * declared ids and two-way props import, and each copy-form two-way prop's
 * state setter (`setOwn<Prop>`) and latest-value ref (`latest<Prop>`); a
 * relayed prop holds no state and declares neither.
 *
 * @param context - The template and its two-way props.
 * @returns The reserved names.
 * @example
 * reactReservedNames({ template, twoWayProps: [{ name: 'pressed', local: 'pressed' }] });
 * // [..., { name: 'setOwnPressed', ... }, { name: 'latestPressed', ... }]
 */
export function reactReservedNames(
  context: ReservedNameContext
): ReservedName[] {
  const names: ReservedName[] = [
    ...COMPONENT_NAMES,
    ...ID_NAMES,
    ...TWO_WAY_NAMES,
  ];
  const { template } = context;
  const nodes = Array.isArray(template) ? template : template?.children;
  let indeterminate = false;
  if (Array.isArray(nodes)) {
    visitElements(nodes, (element) => {
      indeterminate ||= setsIndeterminateThroughRef(element);
    });
  }
  if (indeterminate) {
    names.push(...INDETERMINATE_NAMES);
  }
  for (const { name, local, relayed } of context.twoWayProps) {
    if (relayed === true) continue;
    names.push(
      {
        name: ownSetterName(local),
        description: `React's setter of the own copy of '${name}'`,
        when: 'twoWay',
        readable: false,
        path: `props.${name}`,
      },
      {
        name: latestValueName(local),
        description: `React's ref holding the latest '${name}'`,
        when: 'twoWay',
        readable: false,
        path: `props.${name}`,
      }
    );
  }
  return names;
}
