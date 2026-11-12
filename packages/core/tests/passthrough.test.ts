import type { PropDefinition } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import type {
  ConditionalBranch,
  TemplateNode,
} from '@js-template-engine/types';

import {
  conditionalPassthroughOf,
  discriminantOf,
  flattenDiscriminatedProps,
  passthroughNodeOf,
  unionMembersOf,
} from '../src/passthrough';

describe('flattenDiscriminatedProps', () => {
  it('passes shared props through unchanged, before branch props', () => {
    const shared: Record<string, PropDefinition> = {
      size: { type: 'number' },
      value: { type: 'string | number' },
    };
    const merged = flattenDiscriminatedProps(shared, [
      { visual: { type: 'true', required: true } },
      { visual: { type: 'false' } },
    ]);
    expect(Object.keys(merged)).toEqual(['size', 'value', 'visual']);
    expect(merged.size).toEqual({ type: 'number' });
    expect(merged.value).toEqual({ type: 'string | number' });
  });

  it('unions branch types and collapses the discriminant to `true | false`', () => {
    const merged = flattenDiscriminatedProps({}, [
      { visual: { type: 'true', required: true } },
      { visual: { type: 'false' } },
    ]);
    expect(merged.visual.type).toBe('true | false');
  });

  it('is required only when present and required in every branch', () => {
    // required in both branches → required
    const both = flattenDiscriminatedProps({}, [
      { kind: { type: "'a'", required: true } },
      { kind: { type: "'b'", required: true } },
    ]);
    expect(both.kind.required).toBe(true);

    // required in one branch only → optional
    const one = flattenDiscriminatedProps({}, [
      { kind: { type: "'a'", required: true } },
      { kind: { type: "'b'" } },
    ]);
    expect(one.kind.required).toBe(false);

    // present in one branch only → optional (appears < branch count)
    const partial = flattenDiscriminatedProps({}, [
      { extra: { type: 'string', required: true } },
      {},
    ]);
    expect(partial.extra.required).toBe(false);
  });

  it('deduplicates identical branch types', () => {
    const merged = flattenDiscriminatedProps({}, [
      { id: { type: 'string' } },
      { id: { type: 'string' } },
    ]);
    expect(merged.id.type).toBe('string');
  });

  it('returns the shared props verbatim when there are no branch props', () => {
    const shared: Record<string, PropDefinition> = {
      label: { type: 'string', required: true },
    };
    expect(flattenDiscriminatedProps(shared, [{}, {}])).toEqual(shared);
  });

  it("documents a prop with the description its valued branches agree on", () => {
    const merged = flattenDiscriminatedProps({}, [
      { href: { type: 'string', required: true, description: 'Renders a link.' } },
      { href: { type: 'undefined', description: 'Leave out for a button.' } },
    ]);
    expect(merged.href.description).toBe('Renders a link.');
    // A branch leaving the description out does not object.
    expect(
      flattenDiscriminatedProps({}, [{ visual: { type: 'true', description: 'Draws no control.' } }, { visual: { type: 'false' } }])
        .visual.description
    ).toBe('Draws no control.');
    // The `undefined` side speaks when it alone describes the prop.
    expect(
      flattenDiscriminatedProps({}, [{ href: { type: 'string' } }, { href: { type: 'undefined', description: 'Leave out.' } }]).href
        .description
    ).toBe('Leave out.');
    // Valued branches that differ leave it undocumented.
    expect(
      flattenDiscriminatedProps({}, [
        { visual: { type: 'true', description: 'One.' } },
        { visual: { type: 'false', description: 'Two.' } },
      ]).visual.description
    ).toBeUndefined();
  });
});

describe('discriminantOf', () => {
  const branch = (
    condition: string,
    props: Record<string, PropDefinition> = {}
  ): ConditionalBranch => ({ statement: 'if', condition, props, children: [] });

  it('reads a bare name typed as truthy literals as a literal discriminant', () => {
    expect(
      discriminantOf(
        branch('visual', { visual: { type: 'true', required: true } })
      )
    ).toEqual({
      name: 'visual',
      kind: 'literal',
    });
    expect(
      discriminantOf(
        branch('kind', { kind: { type: "'link' | 1", required: true } })
      )
    ).toEqual({ name: 'kind', kind: 'literal' });
    expect(
      discriminantOf(
        branch('visual', { visual: { type: '( true )', required: true } })
      )
    ).toEqual({ name: 'visual', kind: 'literal' });
  });

  it('reads only `!== undefined` as presence', () => {
    const href = { href: { type: 'string', required: true } };
    expect(discriminantOf(branch(' href !== undefined ', href))).toEqual({
      name: 'href',
      kind: 'presence',
    });
    for (const condition of ['href != null', 'href != undefined']) {
      expect(discriminantOf(branch(condition, href))).toBeUndefined();
    }
  });

  it('reads no discriminant from a bare name of any other type', () => {
    for (const type of ['string', 'boolean', 'number', 'number | 0']) {
      expect(
        discriminantOf(branch('value', { value: { type, required: true } }))
      ).toBeUndefined();
    }
    expect(discriminantOf(branch('value'))).toBeUndefined();
  });

  it('reads no discriminant from an else branch or a compound condition', () => {
    expect(discriminantOf({ statement: 'else', children: [] })).toBeUndefined();
    expect(discriminantOf(branch('href === undefined'))).toBeUndefined();
    expect(discriminantOf(branch('a && b'))).toBeUndefined();
  });
});

describe('unionMembersOf', () => {
  it('splits only top-level members', () => {
    expect(
      unionMembersOf("'a|b' | Array<string | number> | (() => void) | null")
    ).toEqual(["'a|b'", 'Array<string | number>', '() => void', 'null']);
  });

  it('splits a member wrapped whole in parentheses', () => {
    expect(unionMembersOf('( true )')).toEqual(['true']);
    expect(unionMembersOf("('a' | 'b') | null")).toEqual([
      "'a'",
      "'b'",
      'null',
    ]);
    expect(unionMembersOf('(a: string) => void')).toEqual([
      '(a: string) => void',
    ]);
  });
});

describe('conditionalPassthroughOf', () => {
  const element: TemplateNode = {
    type: 'element',
    tag: 'div',
    passthrough: true,
  };
  /** A root conditional with the given branches. */
  function root(conditions: ConditionalBranch[]): TemplateNode[] {
    return [{ type: 'conditional', conditions }];
  }

  it('finds the element of an if with no else, and passthroughNodeOf returns it', () => {
    const children = root([
      { statement: 'if', condition: 'open', children: [element] },
    ]);
    expect(conditionalPassthroughOf(children)?.element).toBe(element);
    expect(conditionalPassthroughOf(children)?.conditional).toBe(children[0]);
    expect(passthroughNodeOf(children)).toBe(element);
  });

  it('accepts an else that renders only comments', () => {
    const children = root([
      { statement: 'if', condition: 'open', children: [element] },
      {
        statement: 'else',
        children: [{ type: 'comment', content: 'closed' }],
      },
    ]);
    expect(conditionalPassthroughOf(children)?.element).toBe(element);
  });

  it('finds nothing for an else that renders, an else-if, a sibling or a plain element', () => {
    const span: TemplateNode = { type: 'element', tag: 'span' };
    for (const children of [
      root([
        { statement: 'if', condition: 'open', children: [element] },
        { statement: 'else', children: [span] },
      ]),
      root([
        { statement: 'if', condition: 'open', children: [element] },
        { statement: 'else-if', condition: 'other', children: [] },
      ]),
      root([{ statement: 'if', condition: 'open', children: [element, span] }]),
      root([{ statement: 'if', condition: 'open', children: [span] }]),
      [element],
    ]) {
      expect(conditionalPassthroughOf(children)).toBeUndefined();
    }
  });
});
