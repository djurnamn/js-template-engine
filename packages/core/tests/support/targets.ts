import type { Extension, ReservedName } from '@js-template-engine/types';

import { latestValueName, ownSetterName } from '../../src/two-way-bindings';

/**
 * Stand-ins for target extensions, reserving the names a target's output
 * declares (`reservedNames`) as the first-party extensions do, so core's
 * reserved-name rules can be tested without them; the extensions' own
 * tables are tested in their packages.
 */
export const reactTarget: Extension = {
  key: 'react',
  reservedNames: ({ twoWayProps }) => [
    { name: 'props', description: "React's component parameter" },
    { name: 'componentStyles', description: "React's in-file stylesheet" },
    { name: 'useBem', description: "React's BEM runtime import" },
    { name: 'Fragment', description: "React's fragment import" },
    { name: 'routedRest', description: "React's routed attributes" },
    { name: 'surfaceProperties', description: "React's undeclared props" },
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
    ...twoWayProps.flatMap(({ name, local, relayed }): ReservedName[] =>
      relayed === true
        ? []
        : [
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
            },
          ]
    ),
  ],
};

/** A stand-in for the Vue extension's reserved names; see {@link reactTarget}. */
export const vueTarget: Extension = {
  key: 'vue',
  reservedNames: [
    { name: 'createBem', description: "Vue's and Svelte's BEM runtime import" },
    { name: 'definedProperties', description: "Vue's attribute helper" },
    { name: 'routedElement', description: "Vue's routed handle" },
    { name: 'vRoutedElement', description: "Vue's routed-handle directive" },
    { name: 'unlessDefaultPrevented', description: "Vue's event helper" },
    {
      name: 'usedOnceListeners',
      description: "Vue's one-shot listener record",
    },
    {
      name: 'claimOnceListener',
      description: "Vue's one-shot listener helper",
    },
    { name: 'useAttrs', description: "Vue's attributes import" },
    {
      name: 'computed',
      description: "Vue's import for the derived values",
      when: 'derived',
    },
    {
      name: 'useId',
      description: "the import React's and Vue's ids use",
      when: 'ids',
    },
    {
      name: 'computed',
      description: "Vue's import for an id following a prop",
      when: 'ids',
    },
    {
      name: 'shallowRef',
      description: "Vue's import for two-way values and handles",
      when: 'ids',
    },
    {
      name: 'emit',
      description: "Vue's emit function for the two-way props",
      when: 'twoWay',
      readable: false,
    },
    {
      name: 'computed',
      description: "Vue's import for the two-way props",
      when: 'twoWay',
    },
    {
      name: 'shallowRef',
      description: "Vue's import for the two-way props",
      when: 'twoWay',
    },
  ],
};

/**
 * A stand-in for the Svelte extension's reserved names and per-mode override
 * blocks; see {@link reactTarget}.
 */
export const svelteTarget: Extension = {
  key: 'svelte',
  overrideBlocks: ['legacy', 'runes'],
  reservedNames: [
    { name: 'createBem', description: "Vue's and Svelte's BEM runtime import" },
    { name: 'serializeStyleObject', description: "Svelte's style helper" },
    {
      name: 'consumerStyleValue',
      description: "Svelte's consumer style helper",
    },
    { name: 'restProperties', description: "Svelte's rest" },
    {
      name: 'once',
      description: "Svelte's once-event helper",
      when: { eventModifiers: ['once'] },
    },
    {
      name: 'on',
      description: "Svelte's event import",
      when: { eventModifiers: ['passive'] },
    },
    {
      name: 'onceRan',
      description: "Svelte's merged one-shot listener record",
      when: { eventModifiers: ['once'] },
    },
    {
      name: 'listenerElement',
      description: "Svelte's attached-listener element",
      when: { eventModifiers: ['passive', 'once'] },
    },
  ],
};

/** The stand-ins of every scripted target, for a build of all of them. */
export const everyTarget = {
  extensions: [reactTarget, vueTarget, svelteTarget],
};
