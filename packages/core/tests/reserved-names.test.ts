import type { Extension } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import {
  isEngineReservedName,
  reservedBindingNames,
  reservedBindingOf,
  resolveReservedNames,
} from '../src/reserved-names';

const target: Extension = {
  key: 'target',
  reservedNames: ({ twoWayProps }) => [
    { name: 'targetHelper', description: "the target's helper" },
    {
      name: 'onTarget',
      description: "the target's listener",
      when: { eventModifiers: ['passive'] },
    },
    { name: 'targetImport', description: "the target's import", when: 'ids' },
    ...twoWayProps.map(({ name, local }) => ({
      name: `${local}Ref`,
      description: `the target's ref of '${name}'`,
      when: 'twoWay' as const,
    })),
  ],
};
const context = {
  template: [],
  twoWayProps: [{ name: 'open', local: 'open' }],
};

describe('reserved names', () => {
  it("lists the engine's names first, then each extension's", () => {
    const names = resolveReservedNames([target, { key: 'plain' }], context).map(
      ({ name }) => name
    );
    expect(names.slice(0, 3)).toEqual(['bem', 'RootTag', 'Tag']);
    expect(names.slice(-4)).toEqual([
      'targetHelper',
      'onTarget',
      'targetImport',
      'openRef',
    ]);
  });

  it('describes a name reserved in every component, a modifier one only with its modifier', () => {
    const names = resolveReservedNames([target], context);
    expect(reservedBindingOf(names, 'bem')).toBe(
      'the BEM runtime the scripted targets set up'
    );
    expect(reservedBindingOf(names, 'Tag3')).toBe(
      'the local a dynamic tag renders through'
    );
    expect(reservedBindingOf(names, 'targetHelper')).toBe(
      "the target's helper"
    );
    expect(reservedBindingOf(names, 'onTarget')).toBeUndefined();
    expect(reservedBindingOf(names, 'onTarget', new Set(['passive']))).toBe(
      "the target's listener"
    );
    expect(reservedBindingOf(names, 'targetImport')).toBeUndefined();
    expect(reservedBindingOf(names, 'label')).toBeUndefined();
  });

  it('gives a prop alias every name reserved in every component or for a modifier', () => {
    expect(
      reservedBindingNames(resolveReservedNames([target], context))
    ).toEqual(
      new Set([
        'bem',
        'RootTag',
        'Tag',
        'authoredOrConsumer',
        'authoredAndConsumer',
        'composeEventHandlers',
        'consumerAttributes',
        'invokeHandler',
        'targetHelper',
        'onTarget',
      ])
    );
  });

  it("knows the engine's own names", () => {
    expect(isEngineReservedName('bem')).toBe(true);
    expect(isEngineReservedName('Tag3')).toBe(true);
    expect(isEngineReservedName('useAttrs')).toBe(false);
  });
});

describe('the emitter entry point', () => {
  it('exports resolveReservedNames, for asking what a build reserves', async () => {
    const emitter = await import('../src/emitter');
    expect(emitter.resolveReservedNames).toBe(resolveReservedNames);
  });
});
