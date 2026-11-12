import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import * as emitter from '../src/emitter';
import { normalizeTemplate } from '../src/normalize';
import * as overrideKeys from '../src/override-keys';
import { collectOverrideKeyWarnings } from '../src/override-keys';

const template = {
  type: 'component',
  name: 'Card',
  extensions: { styler: { theme: 'dark', variant: 'outline' } },
  children: [
    {
      type: 'fragment',
      children: [
        {
          type: 'element',
          tag: 'div',
          extensions: { styler: { tone: 'muted', shade: 2 } },
        },
      ],
    },
  ],
} as unknown as Template;

describe('collectOverrideKeyWarnings', () => {
  it("warns about each key outside an extension's declared lists, with its path", () => {
    const warnings = collectOverrideKeyWarnings(
      normalizeTemplate(template, 'Card'),
      [
        {
          key: 'styler',
          overrideKeys: { node: ['tone'], component: ['theme'] },
        },
      ],
      'children'
    );
    expect(warnings).toEqual([
      {
        message:
          "The styler override has no 'variant' key, so it has no effect; on a component the styler extension reads theme",
        nodePath: 'extensions.styler.variant',
      },
      {
        message:
          "The styler override has no 'shade' key, so it has no effect; on an element the styler extension reads tone",
        nodePath: 'children[0].children[0].extensions.styler.shade',
      },
    ]);
  });

  it('says a styling extension reads nothing on a fragment', () => {
    const fragment = {
      type: 'component',
      name: 'Card',
      children: [
        {
          type: 'fragment',
          extensions: { styler: { tag: 'section' } },
          children: [],
        },
      ],
    } as unknown as Template;
    expect(
      collectOverrideKeyWarnings(
        normalizeTemplate(fragment, 'Card'),
        [{ key: 'styler', overrideKeys: { node: ['tone'] } }],
        'children'
      )
    ).toEqual([
      {
        message:
          "The styler override has no 'tag' key, so it has no effect; on a fragment the styler extension reads nothing",
        nodePath: 'children[0].extensions.styler.tag',
      },
    ]);
  });

  it('leaves blocks unchecked when the extension declares no list or is not in the build', () => {
    const component = normalizeTemplate(template, 'Card');
    expect(
      collectOverrideKeyWarnings(component, [{ key: 'styler' }], 'children')
    ).toEqual([]);
    expect(
      collectOverrideKeyWarnings(
        component,
        [{ key: 'other', overrideKeys: { node: [], component: [] } }],
        'children'
      )
    ).toEqual([]);
  });
});

describe('the override key lists', () => {
  it('names the keys a target reads on a node, under one name', () => {
    expect(emitter.TARGET_NODE_OVERRIDE_KEYS).toEqual(['tag', 'attributes', 'events']);
    expect(emitter.COMPONENT_OVERRIDE_KEYS).toContain('script');
    expect('FRAMEWORK_NODE_OVERRIDE_KEYS' in emitter).toBe(false);
    expect('FRAMEWORK_NODE_OVERRIDE_KEYS' in overrideKeys).toBe(false);
  });

  describe('the unwrap key', () => {
    const wrapped = (extensions: Record<string, unknown>) =>
      normalizeTemplate(
        {
          type: 'component',
          name: 'Card',
          children: [{ type: 'element', tag: 'div', extensions }],
        } as unknown as Template,
        'Card'
      );
    const targetExtension = {
      key: 'vue',
      kind: 'target',
      render: () => ({ files: [], warnings: [] }),
      overrideKeys: { node: ['tag', 'attributes', 'events'] },
    } as never;

    it('names the fragment and tag that replace it, on a target', () => {
      const [warning] = collectOverrideKeyWarnings(
        wrapped({ vue: { unwrap: true } }),
        [targetExtension],
        'children'
      );
      expect(warning.message).toBe(
        "The vue override has no 'unwrap' key, so it has no effect. For a wrapper only some targets render, make the node a fragment and give those targets its tag: { type: 'fragment', extensions: { vue: { tag: 'div' } }, children: [...] }; every other target renders the children alone"
      );
      expect(warning.nodePath).toBe('children[0].extensions.vue.unwrap');
    });

    it('stays the generic message on a styling extension', () => {
      const [warning] = collectOverrideKeyWarnings(
        wrapped({ styler: { unwrap: true } }),
        [{ key: 'styler', overrideKeys: { node: ['tone'] } }],
        'children'
      );
      expect(warning.message).toContain('on an element the styler extension reads tone');
    });
  });
});
