import type { FragmentNode, TemplateNode } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { fragmentWrapper } from '../src/fragment-wrapper';

describe('fragmentWrapper', () => {
  const child: TemplateNode = { type: 'element', tag: 'span' };
  const portal: FragmentNode = {
    type: 'fragment',
    extensions: {
      react: { tag: 'Portal' },
      vue: { tag: 'Teleport', attributes: { to: 'body' } },
    },
    children: [child],
  };

  it("is the element a target's tag override names, carrying that block alone", () => {
    expect(fragmentWrapper(portal, 'vue')).toEqual({
      type: 'element',
      tag: 'Teleport',
      extensions: { vue: { tag: 'Teleport', attributes: { to: 'body' } } },
      children: [child],
    });
  });

  it('keeps the children as the same nodes and reads the fragment as it stands on each call', () => {
    const fragment: FragmentNode = {
      type: 'fragment',
      extensions: { react: { tag: 'section' } },
      children: [child],
    };
    expect(fragmentWrapper(fragment, 'react')?.children?.[0]).toBe(child);
    const next: TemplateNode = { type: 'text', content: 'b' };
    fragment.extensions = { react: { tag: 'article' } };
    fragment.children = [next];
    expect(fragmentWrapper(fragment, 'react')).toEqual({
      type: 'element',
      tag: 'article',
      extensions: { react: { tag: 'article' } },
      children: [next],
    });
  });

  it('is undefined in a target with no tag override, and for any other node', () => {
    expect(fragmentWrapper(portal, 'svelte')).toBeUndefined();
    expect(
      fragmentWrapper({ type: 'fragment', children: [] }, 'react')
    ).toBeUndefined();
    expect(fragmentWrapper(child, 'react')).toBeUndefined();
  });
});
