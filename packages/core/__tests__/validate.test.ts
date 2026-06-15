import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { TemplateError } from '../src/TemplateError';
import { validateTemplate } from '../src/validate';

function expectTemplateError(template: unknown, nodePath: string): void {
  let caught: unknown;
  try {
    validateTemplate(template as Template);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(TemplateError);
  expect((caught as TemplateError).nodePath).toBe(nodePath);
}

describe('validateTemplate', () => {
  it('accepts a complete valid template', () => {
    validateTemplate({
      type: 'component',
      name: 'Button',
      children: [
        {
          type: 'element',
          tag: 'button',
          attributes: { class: ['button'], type: 'button' },
          conditionalAttributes: [
            { condition: 'isLarge', attributes: { class: ['button--large'] } },
          ],
          events: [{ name: 'click', handler: 'handleClick' }],
          children: [
            { type: 'text', expression: 'label' },
            {
              type: 'conditional',
              conditions: [
                { statement: 'if', condition: 'a', children: [] },
                { statement: 'else-if', condition: 'b', children: [] },
                { statement: 'else', children: [] },
              ],
            },
            {
              type: 'iteration',
              items: 'props.items',
              item: 'item',
              key: 'item.id',
              children: [{ type: 'slot', fallback: [] }],
            },
          ],
        },
      ],
    });
  });

  it('rejects component nodes below the root', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          children: [{ type: 'component', name: 'Nested', children: [] }],
        },
      ],
      '[0].children[0]'
    );
  });

  it('rejects component nodes inside a root node array', () => {
    expectTemplateError(
      [
        { type: 'component', name: 'First', children: [] },
        { type: 'component', name: 'Second', children: [] },
      ],
      '[0]'
    );
  });

  it('rejects unknown node types', () => {
    expectTemplateError(
      [{ type: 'element', tag: 'div', children: [{ type: 'portal' }] }],
      '[0].children[0]'
    );
  });

  it('rejects conditionals that do not start with if', () => {
    expectTemplateError(
      [
        {
          type: 'conditional',
          conditions: [{ statement: 'else-if', condition: 'a', children: [] }],
        },
      ],
      '[0].conditions[0]'
    );
  });

  it('rejects else branches before the end', () => {
    expectTemplateError(
      [
        {
          type: 'conditional',
          conditions: [
            { statement: 'if', condition: 'a', children: [] },
            { statement: 'else', children: [] },
            { statement: 'else-if', condition: 'b', children: [] },
          ],
        },
      ],
      '[0].conditions[1]'
    );
  });

  it('rejects empty condition lists', () => {
    expectTemplateError(
      [{ type: 'conditional', conditions: [] }],
      '[0].conditions'
    );
  });

  it('rejects else branches with a condition', () => {
    expectTemplateError(
      [
        {
          type: 'conditional',
          conditions: [
            { statement: 'if', condition: 'a', children: [] },
            { statement: 'else', condition: 'b', children: [] },
          ],
        },
      ],
      '[0].conditions[1]'
    );
  });

  it('rejects if branches without a condition', () => {
    expectTemplateError(
      [{ type: 'conditional', conditions: [{ statement: 'if', children: [] }] }],
      '[0].conditions[0]'
    );
  });

  it('rejects void elements with children', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'img',
          children: [{ type: 'text', content: 'inside' }],
        },
      ],
      '[0]'
    );
  });

  it('accepts expression bindings on class as sole value and array entries', () => {
    validateTemplate([
      {
        type: 'element',
        tag: 'div',
        attributes: { class: { $expression: 'props.className' } },
      },
      {
        type: 'element',
        tag: 'span',
        attributes: { class: ['badge', { $expression: 'props.extraClasses' }] },
      },
    ]);
  });

  it('accepts expression values on top-level style properties and whole-object styles', () => {
    validateTemplate([
      {
        type: 'element',
        tag: 'span',
        attributes: {
          style: {
            color: 'blue',
            '--badge-size': { $expression: "size + 'rem'" },
          },
        },
      },
      {
        type: 'element',
        tag: 'div',
        attributes: { style: { $expression: 'computeStyleVariables(props)' } },
      },
    ]);
  });

  it('rejects empty class expression entries', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { class: ['badge', { $expression: '  ' }] },
        },
      ],
      '[0].attributes.class[1]'
    );
  });

  it('rejects whole-object style expressions mixed with other keys', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            style: { color: 'blue', $expression: 'props.style' },
          },
        },
      ],
      '[0].attributes.style'
    );
  });

  it('rejects expression values inside nested selector blocks', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            style: {
              ':hover': { color: { $expression: 'props.hoverColor' } },
            },
          },
        },
      ],
      '[0].attributes.style.:hover.color'
    );
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            style: {
              '@media (hover: hover)': {
                ':hover': { color: { $expression: 'props.hoverColor' } },
              },
            },
          },
        },
      ],
      '[0].attributes.style.@media (hover: hover).:hover.color'
    );
  });

  it('accepts $include at the top level and inside nested selector blocks', () => {
    validateTemplate([
      {
        type: 'element',
        tag: 'div',
        attributes: {
          style: {
            $include: "typography('body')",
            ':hover': { $include: ['elevation(1)', 'focus-ring()'] },
            '@media (min-width: 768px)': { $include: 'typography(large)' },
          },
        },
      },
    ]);
  });

  it('rejects an empty $include string', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { style: { $include: '   ' } },
        },
      ],
      '[0].attributes.style.$include'
    );
  });

  it('rejects an empty entry in a $include array', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { style: { $include: ['focus-ring()', ''] } },
        },
      ],
      '[0].attributes.style.$include[1]'
    );
  });

  it('rejects expression bindings on class inside conditionalAttributes', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          conditionalAttributes: [
            {
              condition: 'isActive',
              attributes: { class: [{ $expression: 'props.className' }] },
            },
          ],
        },
      ],
      '[0].conditionalAttributes[0].attributes.class[0]'
    );
  });

  it('rejects expression bindings on style inside conditionalAttributes', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          conditionalAttributes: [
            {
              condition: 'isActive',
              attributes: { style: { $expression: 'props.style' } },
            },
          ],
        },
      ],
      '[0].conditionalAttributes[0].attributes.style'
    );
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          conditionalAttributes: [
            {
              condition: 'isActive',
              attributes: {
                style: { color: { $expression: 'props.color' } },
              },
            },
          ],
        },
      ],
      '[0].conditionalAttributes[0].attributes.style.color'
    );
  });

  it('accepts a single key modifier per event definition', () => {
    validateTemplate([
      {
        type: 'element',
        tag: 'input',
        events: [
          { name: 'keyup', handler: 'submitSearch', modifiers: ['enter'] },
          {
            name: 'keydown',
            handler: 'highlightNext',
            modifiers: ['prevent', 'arrow-down'],
          },
        ],
      },
    ]);
  });

  it('rejects multiple key modifiers on one event definition', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'input',
          events: [
            {
              name: 'keydown',
              handler: 'moveFocus',
              modifiers: ['arrow-up', 'arrow-down'],
            },
          ],
        },
      ],
      '[0].events[0].modifiers'
    );
  });

  it('rejects empty expressions', () => {
    expectTemplateError(
      [{ type: 'text', expression: '   ' }],
      '[0].expression'
    );
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'img',
          attributes: { src: { $expression: '' } },
        },
      ],
      '[0].attributes.src'
    );
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'button',
          events: [{ name: 'click', handler: '' }],
        },
      ],
      '[0].events[0].handler'
    );
  });

  it('rejects slot nodes inside slot fallbacks', () => {
    expectTemplateError(
      [
        {
          type: 'slot',
          fallback: [
            {
              type: 'element',
              tag: 'div',
              children: [{ type: 'slot' }],
            },
          ],
        },
      ],
      '[0].fallback[0].children[0]'
    );
  });

  it('rejects text nodes with both content and expression', () => {
    expectTemplateError(
      [{ type: 'text', content: 'Hello', expression: 'user.name' }],
      '[0]'
    );
  });

  it('rejects text nodes with neither content nor expression', () => {
    expectTemplateError([{ type: 'text' }], '[0]');
  });

  describe('passthrough surface contract', () => {
    it('accepts a single passthrough root with an intrinsic tag', () => {
      validateTemplate({
        type: 'component',
        name: 'Badge',
        props: { variant: { type: 'string' } },
        children: [
          {
            type: 'element',
            tag: 'span',
            passthrough: true,
            attributes: { class: ['badge'] },
            children: [{ type: 'slot' }],
          },
        ],
      });
    });

    it('accepts a passthrough root alongside leading comments', () => {
      validateTemplate([
        { type: 'comment', content: 'surface root' },
        { type: 'element', tag: 'div', passthrough: true },
      ]);
    });

    it('rejects a second passthrough element', () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: 'div',
            passthrough: true,
            children: [{ type: 'element', tag: 'span', passthrough: true }],
          },
        ],
        '[0].children[0]'
      );
    });

    it('rejects a passthrough element that is not the single root', () => {
      expectTemplateError(
        [
          { type: 'element', tag: 'div' },
          { type: 'element', tag: 'span', passthrough: true },
        ],
        '[1]'
      );
    });

    it('rejects a nested passthrough element', () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: 'div',
            children: [{ type: 'element', tag: 'span', passthrough: true }],
          },
        ],
        '[0].children[0]'
      );
    });

    it('rejects a passthrough on a component-reference tag', () => {
      expectTemplateError(
        [{ type: 'element', tag: 'UserAvatar', passthrough: true }],
        '[0]'
      );
    });

    it('rejects a reserved prop on a passthrough component', () => {
      expectTemplateError(
        {
          type: 'component',
          name: 'Badge',
          props: { className: { type: 'string' } },
          children: [{ type: 'element', tag: 'span', passthrough: true }],
        },
        'children[0]'
      );
    });

    it('rejects a reserved slot name on a passthrough component', () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: 'span',
            passthrough: true,
            children: [{ type: 'slot', name: 'style' }],
          },
        ],
        '[0]'
      );
    });
  });

  describe('dynamic root tag', () => {
    it('accepts a dynamic tag on the single root element', () => {
      validateTemplate({
        type: 'component',
        name: 'Box',
        props: { as: { type: "'div' | 'section'", default: 'div' } },
        children: [
          {
            type: 'element',
            tag: { $expression: 'as', default: 'div' },
            attributes: { class: ['box'] },
          },
        ],
      });
    });

    it('accepts a dynamic tag layered onto a passthrough root', () => {
      validateTemplate([
        {
          type: 'element',
          tag: { $expression: 'as', default: 'button' },
          passthrough: true,
        },
      ]);
    });

    it('rejects a dynamic tag on a nested (non-root) element', () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: 'div',
            children: [
              { type: 'element', tag: { $expression: 'as', default: 'span' } },
            ],
          },
        ],
        '[0].children[0]'
      );
    });

    it('rejects a dynamic tag when the root is not the single rendered element', () => {
      expectTemplateError(
        [
          { type: 'element', tag: { $expression: 'as', default: 'div' } },
          { type: 'element', tag: 'span' },
        ],
        '[0]'
      );
    });

    it("rejects a void 'default' with children (rule 5 against the default)", () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: { $expression: 'as', default: 'img' },
            children: [{ type: 'text', content: 'x' }],
          },
        ],
        '[0]'
      );
    });

    it("rejects a missing 'default'", () => {
      expectTemplateError(
        [{ type: 'element', tag: { $expression: 'as' } }],
        '[0].tag.default'
      );
    });

    it("rejects an empty 'default'", () => {
      expectTemplateError(
        [{ type: 'element', tag: { $expression: 'as', default: '  ' } }],
        '[0].tag.default'
      );
    });

    it('rejects an empty dynamic-tag expression', () => {
      expectTemplateError(
        [{ type: 'element', tag: { $expression: '', default: 'div' } }],
        '[0].tag.$expression'
      );
    });

    it("rejects a passthrough root whose dynamic 'default' is a component reference", () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: { $expression: 'as', default: 'CustomBox' },
            passthrough: true,
          },
        ],
        '[0]'
      );
    });
  });
});
