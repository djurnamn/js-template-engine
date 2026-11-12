import type { ElementNode } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { withoutRemovedBemRuntimeCalls } from '../src/bem-runtime';
import type { BemRuntimeCall, NormalizedComponent } from '../src/normalize';

function element(name: string): ElementNode {
  return { type: 'element', tag: 'span', attributes: { id: name } };
}

function call(elementName: string | undefined): BemRuntimeCall {
  return {
    block: 'Badge',
    declaresBlock: elementName === undefined,
    elementName,
    staticModifiers: [],
    conditionalModifiers: [],
    contributedClasses: [],
    foldedConditionalClasses: [],
  };
}

const root = element('root');
const label = element('label');

const component: NormalizedComponent = {
  name: 'Badge',
  props: {},
  imports: [],
  children: [root, label],
  extensions: {},
  bemRuntime: {
    block: 'Badge',
    elementSeparator: '__',
    modifierSeparator: '--',
    importSource: 'use-bem',
  },
  bemRuntimeCalls: new Map([
    [root, call(undefined)],
    [label, call('label')],
  ]),
};

describe('withoutRemovedBemRuntimeCalls', () => {
  it('returns the component itself when the target removes no class', () => {
    expect(withoutRemovedBemRuntimeCalls(component, () => false)).toBe(
      component
    );
  });

  it('drops the calls of the elements whose class the target removes', () => {
    const result = withoutRemovedBemRuntimeCalls(
      component,
      (candidate) => candidate === root
    );
    expect(result.bemRuntime).toEqual(component.bemRuntime);
    expect([...(result.bemRuntimeCalls?.keys() ?? [])]).toEqual([label]);
  });

  it('drops the binding once no call remains', () => {
    const result = withoutRemovedBemRuntimeCalls(component, () => true);
    expect(result.bemRuntime).toBeUndefined();
    expect(result.bemRuntimeCalls).toBeUndefined();
    expect(result.children).toBe(component.children);
  });

  it('leaves a component outside runtime mode as it is', () => {
    const { bemRuntime: _binding, bemRuntimeCalls: _calls, ...plain } =
      component;
    expect(withoutRemovedBemRuntimeCalls(plain, () => true)).toBe(plain);
  });
});
