import type { ProcessResult, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import type { TargetExtension } from '../src/extension';
import { process } from '../src/process';
import { literalMembersWithoutRest } from '../src/rest-spread';

const target: TargetExtension = {
  key: 'stub',
  kind: 'target',
  render: (): ProcessResult => ({ files: [], warnings: [] }),
};

function restTemplate(attributes: Record<string, unknown>, extensions?: Record<string, unknown>): Template {
  return {
    type: 'component',
    name: 'Box',
    rest: { tag: 'div' },
    children: [{ type: 'element', tag: 'div', attributes: attributes as never, ...(extensions ? { extensions } : {}) }],
  };
}

const warningsOf = (
  template: Template,
  extension: TargetExtension = target,
  placement?: 'inline' | 'in-file'
): string[] =>
  process(template, { extensions: [extension], ...(placement ? { styling: { placement } } : {}) }).warnings.map(
    (warning) => warning.message
  );

/** A style that renders inline under every strategy. */
const tone = { color: { $expression: 'tone' } };

/** A target keeping the consumer's class from `rest` under `classKey`, as React and Svelte do. */
const keyed = (key: string, classKey: string): TargetExtension => ({
  ...target,
  key,
  restClassAndStyle: { classKey },
});

describe('rest spread warnings', () => {
  it('warns when a node spreads rest and carries its own class', () => {
    expect(warningsOf(restTemplate({ $spread: { $expression: 'rest' }, class: ['box'] }))).toEqual([
      "<div> spreads rest and also carries its own class, which replaces the consumer's class carried in rest. Spread rest onto a passthrough component, which merges it, merge the class in a helper, or set the node's class in this target's override from an expression that reads the consumer's (consumerClass(rest) from @scaffold-ui-kit/helpers/runtime, or rest.className in React, rest.class in Svelte).",
    ]);
  });

  it.each([
    "['box', consumerClass(rest)].filter(Boolean).join(' ')",
    'consumerClass( rest )',
    'mergeRootProps(api.getRootProps(), rest).class',
  ])('takes %s in the override as keeping the consumer class', (expression) => {
    expect(
      warningsOf(
        restTemplate(
          { $spread: { $expression: 'rest' }, class: ['box'] },
          { react: { attributes: { className: { $expression: expression } } } }
        ),
        keyed('react', 'className')
      )
    ).toEqual([]);
  });

  it.each(['consumerClass(other)', 'consumerClass(props.rest)', 'mergeRootProps(other).class', 'my.consumerClass(rest)'])(
    'still warns on %s, which does not keep the consumer class',
    (expression) => {
      expect(
        warningsOf(
          restTemplate(
            { $spread: { $expression: 'rest' }, class: ['box'] },
            { react: { attributes: { className: { $expression: expression } } } }
          ),
          keyed('react', 'className')
        )
      ).toHaveLength(1);
    }
  );

  it('warns on an own inline style', () => {
    expect(warningsOf(restTemplate({ $spread: { $expression: 'rest' }, style: tone }))[0]).toContain('its own style');
    expect(
      warningsOf(restTemplate({ $spread: { $expression: 'rest' }, style: { $expression: 'styles' } }))[0]
    ).toContain('its own style');
    expect(
      warningsOf(restTemplate({ $spread: { $expression: 'rest' }, style: { color: 'red' } }), target, 'inline')[0]
    ).toContain('its own style');
  });

  it('does not warn on a static style the stylesheet carries', () => {
    expect(warningsOf(restTemplate({ $spread: { $expression: 'rest' }, style: { color: 'red' } }))).toEqual([]);
    // Nested selectors send the whole style to the stylesheet under `inline` too.
    expect(
      warningsOf(
        restTemplate({ $spread: { $expression: 'rest' }, style: { color: 'red', ':hover': { color: 'blue' } } }),
        target,
        'inline'
      )
    ).toEqual([]);
  });

  it('does not warn on expression properties a target writes as directives, as Svelte does', () => {
    const directives: TargetExtension = {
      ...target,
      key: 'svelte',
      restClassAndStyle: { classKey: 'class', styleString: true, styleDirectives: true },
    };
    expect(warningsOf(restTemplate({ $spread: { $expression: 'rest' }, style: tone }), directives)).toEqual([]);
    expect(
      warningsOf(restTemplate({ $spread: { $expression: 'rest' }, style: { $expression: 'styles' } }), directives)
    ).toHaveLength(1);
  });

  it("reports a node's class and style together", () => {
    const messages = warningsOf(restTemplate({ $spread: { $expression: 'rest' }, class: ['box'], style: tone }));
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('its own class');
    expect(messages[1]).toContain('its own style');
  });

  it('leaves a helper call and a classless node alone', () => {
    expect(warningsOf(restTemplate({ $spread: { $expression: 'merge(rest)' }, class: ['box'] }))).toEqual([]);
    expect(warningsOf(restTemplate({ $spread: { $expression: 'rest' }, type: 'button' }))).toEqual([]);
  });

  it('does not warn for a target that merges class and style, as Vue does', () => {
    const merging: TargetExtension = { ...target, restClassAndStyle: 'merged' };
    expect(
      warningsOf(restTemplate({ $spread: { $expression: 'rest' }, class: ['box'], style: { color: 'red' } }), merging)
    ).toEqual([]);
  });

  it("does not warn where the target's class override reads the consumer's class", () => {
    const template = restTemplate(
      { $spread: { $expression: 'rest' }, class: ['box'] },
      {
        react: { attributes: { class: ['box', { $expression: 'rest.className' }] } },
        svelte: { attributes: { class: { $expression: "[\"box\", rest?.['class']]" } } },
      }
    );
    expect(warningsOf(template, keyed('react', 'className'))).toEqual([]);
    expect(warningsOf(template, keyed('svelte', 'class'))).toEqual([]);
  });

  it("reads the target's class override, as for the style", () => {
    const template = restTemplate(
      { $spread: { $expression: 'rest' } },
      { react: { attributes: { class: ['box'] } }, svelte: { attributes: { class: ['box', { $expression: 'rest.class' }] } } }
    );
    expect(warningsOf(template, keyed('react', 'className'))[0]).toContain('its own class');
    expect(warningsOf(template, keyed('svelte', 'class'))).toEqual([]);
  });

  it('does not warn where the target removes the class or style with null', () => {
    const template = restTemplate(
      { $spread: { $expression: 'rest' }, class: ['box'], style: tone },
      { react: { attributes: { class: null, style: null } } }
    );
    expect(warningsOf(template, keyed('react', 'className'))).toEqual([]);
    expect(warningsOf(template, keyed('svelte', 'class'))).toHaveLength(2);
  });

  it('reads className as the class only where the target spells it so', () => {
    const template = restTemplate(
      { $spread: { $expression: 'rest' }, class: ['box'] },
      { react: { attributes: { className: null } }, svelte: { attributes: { className: null } } }
    );
    expect(warningsOf(template, keyed('react', 'className'))).toEqual([]);
    expect(warningsOf(template, keyed('svelte', 'class'))).toHaveLength(1);
  });

  it('warns where an override removes the rest spread and nothing else spreads it', () => {
    const template = restTemplate(
      { $spread: { $expression: 'rest' }, class: ['box'] },
      { react: { attributes: { $spread: null } } }
    );
    expect(warningsOf(template, keyed('react', 'className'))).toEqual([
      "<div>'s react override removes its rest spread, and no other element spreads rest, so the consumer's attributes carried in rest are not forwarded in react.",
    ]);
    expect(warningsOf(template, keyed('svelte', 'class'))).toHaveLength(1);
    const moved: Template = {
      type: 'component',
      name: 'Box',
      rest: { tag: 'div' },
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { $spread: { $expression: 'rest' } },
          extensions: { react: { attributes: { $spread: null } } },
          children: [
            {
              type: 'element',
              tag: 'span',
              extensions: { react: { attributes: { $spread: { $expression: 'rest' } } } },
            },
          ],
        },
      ],
    };
    expect(warningsOf(moved, keyed('react', 'className'))).toEqual([]);
  });

  it("still warns where the override reads another target's key, or none", () => {
    const template = restTemplate(
      { $spread: { $expression: 'rest' }, class: ['box'] },
      {
        react: { attributes: { class: ['box', { $expression: 'rest.class' }] } },
        svelte: { attributes: { class: ['box', { $expression: 'forest.class' }] } },
      }
    );
    expect(warningsOf(template, keyed('react', 'className'))).toHaveLength(1);
    expect(warningsOf(template, keyed('svelte', 'class'))).toHaveLength(1);
    expect(warningsOf(template, keyed('other', 'class'))).toHaveLength(1);
  });

  it('warns about the style when only the class override reads rest', () => {
    const template = restTemplate(
      { $spread: { $expression: 'rest' }, class: ['box'], style: tone },
      { react: { attributes: { class: [{ $expression: 'rest.className' }] } } }
    );
    const messages = warningsOf(template, keyed('react', 'className'));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('its own style');
    const both = restTemplate(
      { $spread: { $expression: 'rest' }, class: ['box'], style: { color: 'red' } },
      {
        react: {
          attributes: {
            class: [{ $expression: 'rest.className' }],
            style: { $expression: 'rest.style', color: 'red' },
          },
        },
      }
    );
    expect(warningsOf(both, keyed('react', 'className'))).toEqual([]);
  });

  it('counts an object spread of rest.style as reading it', () => {
    const styled = (expression: string): Template =>
      restTemplate(
        { $spread: { $expression: 'rest' }, style: { color: 'red' } },
        { react: { attributes: { style: { $expression: expression } } } }
      );
    expect(warningsOf(styled('{ ...styles?.root, ...rest.style }'), keyed('react', 'className'))).toEqual([]);
    expect(warningsOf(styled('{ ...rest.style, ...styles?.root }'), keyed('react', 'className'))).toEqual([]);
    expect(warningsOf(styled('{ ... rest?.style }'), keyed('react', 'className'))).toEqual([]);
    expect(warningsOf(styled('Object.assign({}, styles?.root, rest.style)'), keyed('react', 'className'))).toEqual([]);
    // A member of another value is not the consumer's.
    expect(warningsOf(styled('{ ...props.rest.style }'), keyed('react', 'className'))).toHaveLength(1);
    expect(warningsOf(styled('{ ...forest.style }'), keyed('react', 'className'))).toHaveLength(1);
  });

  it('warns where a string rest.style is spread or assigned as an object, as in Svelte', () => {
    const svelteLike: TargetExtension = {
      ...target,
      key: 'svelte',
      restClassAndStyle: { classKey: 'class', styleString: true },
    };
    const styled = (expression: string): Template =>
      restTemplate(
        { $spread: { $expression: 'rest' }, style: { color: 'red' } },
        { svelte: { attributes: { style: { $expression: expression } } } }
      );
    for (const expression of [
      '{ ...styles?.root, ...rest.style }',
      'Object.assign({}, styles?.root, rest?.style)',
      'Object.assign({}, part(styles, "root"), rest.style)',
      "{ ...rest['style'] }",
    ]) {
      expect(warningsOf(styled(expression), svelteLike)).toEqual([
        "<div>'s style override reads rest.style as an object, but in this target it is the consumer's style string, so a spread or Object.assign breaks it into characters. List it after the node's own style instead: [{ ... }, rest.style].",
      ]);
    }
    expect(warningsOf(styled('[styles?.root, rest.style]'), svelteLike)).toEqual([]);
    expect(warningsOf(styled('rest.style'), svelteLike)).toEqual([]);
    for (const expression of [
      'Object.assign({}, styles?.root, rest.style ?? {})',
      'Object.assign({}, styles?.root, rest.style as Record<string, string>)',
      'Object.assign({}, styles?.root, (rest.style))',
      'Object.assign({}, styles?.root, open ? rest.style : {})',
      'Object.assign({}, styles?.root, open ? {} : (rest.style satisfies object))',
      '{ ...(rest.style as Record<string, string>) }',
      '{ ...(open ? rest.style : {}), gap }',
      "Object.assign({}, /[,)]/.test(mode) ? {} : null, rest.style)",
    ]) {
      expect(warningsOf(styled(expression), svelteLike), expression).toHaveLength(1);
    }
    // An expression that hands the string on as an array entry or to a
    // parser treats it as a string, whatever else it assigns.
    for (const expression of [
      '[Object.assign({}, styles?.root), rest.style]',
      "Object.assign({}, styles?.root, '/rest.style/')",
      'Object.assign({}, styles?.root, rest.style.length ? {} : null)',
      "Object.assign({}, styles?.root, Object.fromEntries(String(rest.style ?? '').split(';').map((entry) => entry.split(':'))))",
    ]) {
      expect(warningsOf(styled(expression), svelteLike)).toEqual([]);
    }
    // The class is still checked beside it.
    const both = restTemplate(
      { $spread: { $expression: 'rest' }, class: ['box'], style: { color: 'red' } },
      { svelte: { attributes: { style: { $expression: '{ ...rest.style }' } } } }
    );
    const messages = warningsOf(both, svelteLike);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('reads rest.style as an object');
    expect(messages[1]).toContain('its own class');
  });

  it('gives the Svelte form of a style merge in the warning', () => {
    expect(warningsOf(restTemplate({ $spread: { $expression: 'rest' }, style: tone }))[0]).toContain(
      '[ownStyle, rest.style]'
    );
  });

  it('does not warn in HTML mode, where nothing spreads', () => {
    expect(process(restTemplate({ $spread: { $expression: 'rest' }, class: ['box'] })).warnings).toEqual([]);
  });
});

describe('literalMembersWithoutRest', () => {
  it('takes the top-level spreads of rest.<key> out of an object literal', () => {
    expect(literalMembersWithoutRest('{ ...styles?.root, ...rest.style }', 'style')).toEqual(['...styles?.root']);
    expect(literalMembersWithoutRest("{ ...rest.style, color: 'red', }", 'style')).toEqual(["color: 'red'"]);
    expect(literalMembersWithoutRest('{ ...rest.style }', 'style')).toEqual([]);
    expect(literalMembersWithoutRest("{ ...rest['style'] }", 'style')).toEqual([]);
  });

  it('leaves a nested spread, another value and a non-literal alone', () => {
    expect(literalMembersWithoutRest('{ inner: { ...rest.style } }', 'style')).toBeUndefined();
    expect(literalMembersWithoutRest('{ ...props.rest.style }', 'style')).toBeUndefined();
    expect(literalMembersWithoutRest('{ ...rest.styles }', 'style')).toBeUndefined();
    expect(literalMembersWithoutRest('merge(styles, rest.style)', 'style')).toBeUndefined();
    expect(literalMembersWithoutRest('{ a: 1 } && { ...rest.style }', 'style')).toBeUndefined();
  });
});
