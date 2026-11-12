import type { ComponentNode, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { renderInstance } from '../src/html/render-instance';

const card: Template = {
  type: 'component',
  name: 'Card',
  props: { title: { type: 'string', required: true } },
  children: [
    {
      type: 'element',
      tag: 'article',
      passthrough: true,
      attributes: { class: ['card'] },
      children: [
        {
          type: 'element',
          tag: 'h2',
          children: [{ type: 'text', expression: 'title' }],
        },
        {
          type: 'conditional',
          conditions: [
            {
              statement: 'if',
              condition: 'footer',
              children: [
                {
                  type: 'element',
                  tag: 'footer',
                  children: [{ type: 'slot', name: 'footer' }],
                },
              ],
            },
          ],
        },
        {
          type: 'slot',
          exposes: { count: 'title.length' },
          fallback: [{ type: 'text', content: 'Empty' }],
        },
      ],
    },
  ],
};

function resolveComponent(tag: string): Template | undefined {
  return tag === 'Card' ? card : undefined;
}

describe('renderInstance', () => {
  it('applies defaults, takes one branch and expands loops with their index', () => {
    const { markup, warnings } = renderInstance(
      {
        type: 'component',
        name: 'List',
        props: {
          items: { type: 'string[]', default: ['a', 'b'] },
          ordered: { type: 'boolean', default: false },
        },
        children: [
          {
            type: 'element',
            tag: { $expression: "ordered ? 'ol' : 'ul'", default: 'ul' },
            children: [
              {
                type: 'iteration',
                items: 'items',
                item: 'item',
                index: 'i',
                children: [
                  {
                    type: 'element',
                    tag: 'li',
                    attributes: { 'data-index': { $expression: 'i' } },
                    children: [
                      { type: 'text', expression: 'item.toUpperCase()' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { props: { ordered: true } }
    );
    expect(markup).toBe(
      [
        '<ol',
        '  ><li data-index="0">A</li',
        '  ><li data-index="1">B</li',
        '></ol>',
      ].join('\n')
    );
    expect(warnings).toEqual([]);
  });

  it('renders a referenced component inline, its props, slots and exposed values resolved', () => {
    const { markup } = renderInstance(
      [
        {
          type: 'element',
          tag: 'Card',
          attributes: { title: { $expression: "'Hello'" }, class: ['wide'] },
          slotScope: ['count'],
          slots: { footer: [{ type: 'text', content: 'Footnote' }] },
          children: [
            {
              type: 'element',
              tag: 'p',
              children: [{ type: 'text', expression: "count + ' letters'" }],
            },
          ],
        },
      ],
      { resolveComponent }
    );
    expect(markup).toBe(
      [
        '<article class="card wide"',
        '  ><h2>Hello</h2',
        '  ><footer>Footnote</footer',
        '  ><p>5 letters</p',
        '></article>',
      ].join('\n')
    );
  });

  it('fills slots from markup or template nodes passed in, and renders the fallback otherwise', () => {
    expect(
      renderInstance(card, {
        props: { title: 'A', className: 'outer', id: 'card' },
        slots: { footer: '<em>Note</em>' },
      }).markup
    ).toBe(
      [
        '<article class="card outer" id="card"',
        '  ><h2>A</h2',
        '  ><footer><em>Note</em></footer>Empty</article>',
      ].join('\n')
    );
    expect(
      renderInstance(card, {
        props: { title: 'A' },
        children: [
          { type: 'element', tag: 'Card', attributes: { title: 'Inner' } },
        ],
        resolveComponent,
      }).markup
    ).toContain('  ><article class="card"\n    ><h2>Inner</h2>');
  });

  it('leaves out a DOM property with no attribute, which markup cannot set', () => {
    const { markup } = renderInstance(
      {
        type: 'component',
        name: 'Checkbox',
        props: { mixed: { type: 'boolean' } },
        children: [
          {
            type: 'element',
            tag: 'input',
            attributes: {
              type: 'checkbox',
              indeterminate: { $expression: 'mixed' },
            },
          },
        ],
      },
      { props: { mixed: true } }
    );
    expect(markup).toBe('<input type="checkbox">');
  });

  it('leaves out what cannot be evaluated, with one warning each', () => {
    const { markup, warnings } = renderInstance({
      type: 'component',
      name: 'Toggle',
      script: 'const api = createMachine();',
      children: [
        {
          type: 'element',
          tag: 'button',
          attributes: {
            $spread: { $expression: 'api.getTriggerProps()' },
            'aria-pressed': { $expression: 'api.pressed' },
          },
          children: [{ type: 'text', expression: 'api.label' }],
        },
      ],
    });
    expect(markup).toBe('<button></button>');
    expect(warnings.map((warning) => warning.message)).toEqual([
      'Toggle: could not evaluate api.getTriggerProps() (api is not defined)',
      'Toggle: could not evaluate api.pressed (api is not defined)',
      'Toggle: could not evaluate api.label (api is not defined)',
    ]);
    expect(warnings.every((warning) => warning.kind === 'unevaluated')).toBe(
      true
    );
  });

  it('leaves out what a composed component builds from a prop the reference could not evaluate', () => {
    const wrapper: Template = {
      type: 'component',
      name: 'Wrapper',
      props: {
        inputId: { type: 'string' },
        label: { type: 'string', default: 'Name' },
      },
      children: [
        {
          type: 'element',
          tag: 'p',
          attributes: {
            id: { $expression: '`${inputId}-description`' },
            title: { $expression: 'label' },
            'data-has-id': { $expression: 'props.inputId === undefined' },
          },
        },
      ],
    };
    const { markup, warnings } = renderInstance(
      {
        type: 'component',
        name: 'Field',
        script: 'const inputId = useId();',
        children: [
          {
            type: 'element',
            tag: 'Wrapper',
            attributes: {
              inputId: { $expression: 'inputId' },
              label: { $expression: "'Email'" },
            },
          },
        ],
      },
      { resolveComponent: (tag) => (tag === 'Wrapper' ? wrapper : undefined) }
    );
    expect(markup).toBe('<p title="Email" data-has-id="true"></p>');
    expect(warnings.map((warning) => warning.message)).toEqual([
      'Field: could not evaluate inputId (inputId is not defined)',
      'Wrapper: could not evaluate `${inputId}-description` (inputId has no value at rest)',
    ]);
  });

  it('reads a prop the reference could not evaluate as not given: its default applies, and another name sharing its text is unaffected', () => {
    const field: Template = {
      type: 'component',
      name: 'Field',
      props: {
        id: { type: 'string', default: 'email' },
        label: { type: 'string' },
        variant: { type: 'string', default: 'plain' },
      },
      children: [
        {
          type: 'element',
          tag: 'input',
          attributes: {
            id: { $expression: 'id' },
            class: [{ $expression: '`field--${variant}`' }],
            'aria-labelledby': { $expression: '`${id}-label`' },
          },
        },
      ],
    };
    const { markup, warnings } = renderInstance(
      {
        type: 'component',
        name: 'Form',
        script: 'const t = useTranslation();',
        children: [
          {
            type: 'element',
            tag: 'Field',
            attributes: {
              label: { $expression: "t('email')" },
              variant: { $expression: 't.variant' },
            },
          },
        ],
      },
      { resolveComponent: (tag) => (tag === 'Field' ? field : undefined) }
    );
    expect(markup).toBe(
      '<input class="field--plain" id="email" aria-labelledby="email-label">'
    );
    expect(warnings.map((warning) => warning.message)).toEqual([
      "Form: could not evaluate t('email') (t is not defined)",
      'Form: could not evaluate t.variant (t is not defined)',
    ]);
  });

  it('leaves out a function the composed component takes, which the reference could not evaluate, without a warning', () => {
    const tagList: Template = {
      type: 'component',
      name: 'TagList',
      props: {
        tags: { type: 'string[]', default: [] },
        onRemove: { type: '((tag: string) => void) | undefined' },
        format: { type: '(tag: string) => string' },
        title: { type: 'string' },
        hint: { type: 'string | (() => string)' },
      },
      children: [
        {
          type: 'element',
          tag: 'ul',
          attributes: {
            title: { $expression: 'title' },
            'data-first': { $expression: 'tags[0]' },
          },
        },
      ],
    };
    const { markup, warnings } = renderInstance(
      {
        type: 'component',
        name: 'MultiSelect',
        script: 'function removeTag(tag) {}\nconst label = useLabel();',
        children: [
          {
            type: 'element',
            tag: 'TagList',
            attributes: {
              tags: { $expression: "['Iceland']" },
              onRemove: { $expression: 'removeTag' },
              format: { $expression: '(tag) => removeTag(tag)' },
              title: { $expression: 'label' },
              hint: { $expression: 'hintText' },
            },
          },
        ],
      },
      { resolveComponent: (tag) => (tag === 'TagList' ? tagList : undefined) }
    );
    expect(markup).toBe('<ul data-first="Iceland"></ul>');
    // A prop that could hold text is warned of, even beside a function type.
    expect(warnings.map((warning) => warning.message)).toEqual([
      'MultiSelect: could not evaluate label (label is not defined)',
      'MultiSelect: could not evaluate hintText (hintText is not defined)',
      'TagList: could not evaluate title (title has no value at rest)',
    ]);
  });

  it('renders a driver content at rest inside a behavior comment, its exposed values reading as nothing', () => {
    const { markup, warnings } = renderInstance(
      {
        type: 'component',
        name: 'Select',
        props: { placeholder: { type: 'string' } },
        children: [
          {
            type: 'element',
            tag: 'SelectDriver',
            slotScope: ['api'],
            children: [
              {
                type: 'element',
                tag: 'button',
                attributes: {
                  $spread: { $expression: 'api.getTriggerProps()' },
                  'aria-expanded': { $expression: 'api.open' },
                },
                children: [
                  {
                    type: 'text',
                    expression: "api.valueAsString || (placeholder ?? '')",
                  },
                ],
              },
              {
                type: 'conditional',
                conditions: [
                  {
                    statement: 'if',
                    condition: 'api.open',
                    children: [{ type: 'element', tag: 'ul' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        props: { placeholder: 'move to' },
        resolveComponent: () => ({ rendersAs: 'content' }),
      }
    );
    expect(markup).toBe(
      [
        '<!-- component: SelectDriver (behavior not included) --><button>move to</button',
        '><!-- /component -->',
      ].join('\n')
    );
    // The call into the driver's api has no result at rest by design, which
    // the behavior comment says: it is no warning (#365).
    expect(warnings).toEqual([]);
  });

  it("passes a prop read from a driver's api as unset, so the composed template reads it without a warning", () => {
    const trigger: Template = {
      type: 'component',
      name: 'Trigger',
      props: { above: { type: 'boolean' }, extra: { type: 'Record<string, unknown>' } },
      children: [
        {
          type: 'element',
          tag: 'button',
          attributes: {
            $spread: { $expression: 'extra ?? {}' },
            'data-above': { $expression: "above === true ? 'yes' : 'no'" },
          },
        },
      ],
    };
    const { markup, warnings } = renderInstance(
      {
        type: 'component',
        name: 'Select',
        children: [
          {
            type: 'element',
            tag: 'SelectDriver',
            slotScope: ['api'],
            children: [
              {
                type: 'element',
                tag: 'Trigger',
                attributes: {
                  above: { $expression: "api.placement.startsWith('top')" },
                  extra: { $expression: 'api.getTriggerProps()' },
                },
              },
            ],
          },
        ],
      },
      {
        resolveComponent: (tag) =>
          tag === 'Trigger' ? trigger : { rendersAs: 'content' },
      }
    );
    expect(markup).toContain('<button data-above="no"></button');
    expect(warnings).toEqual([]);
  });

  it('still warns on an expression that fails for a reason of its own beside an at-rest value', () => {
    const { warnings } = renderInstance(
      {
        type: 'component',
        name: 'Select',
        children: [
          {
            type: 'element',
            tag: 'SelectDriver',
            slotScope: ['api'],
            children: [
              {
                type: 'element',
                tag: 'button',
                attributes: { title: { $expression: 'missing.label' } },
              },
            ],
          },
        ],
      },
      { resolveComponent: () => ({ rendersAs: 'content' }) }
    );
    expect(warnings.map((warning) => warning.message)).toEqual([
      'Select: could not evaluate missing.label (missing is not defined)',
    ]);
  });

  it('renders a hand-written component default content, then its named slots', () => {
    expect(
      renderInstance(
        [
          {
            type: 'element',
            tag: 'DialogDriver',
            slotScope: ['api'],
            slots: { title: [{ type: 'text', content: 'Hi' }] },
            children: [
              {
                type: 'element',
                tag: 'div',
                attributes: { class: ['dialog'] },
              },
            ],
          },
        ],
        { resolveComponent: () => ({ rendersAs: 'content' }) }
      ).markup
    ).toBe(
      [
        '<!-- component: DialogDriver (behavior not included) --><div class="dialog"></div>Hi<!-- /component -->',
      ].join('\n')
    );
  });

  it('renders a hand-written component as the template it names, with its props and content', () => {
    const visual: Template = {
      type: 'component',
      name: 'TextareaVisual',
      props: { rows: { type: 'number', default: 3 } },
      children: [
        {
          type: 'element',
          tag: 'textarea',
          passthrough: true,
          attributes: { class: ['field'], rows: { $expression: 'rows' } },
          children: [{ type: 'slot' }],
        },
      ],
    };
    expect(
      renderInstance(
        [
          {
            type: 'element',
            tag: 'Textarea',
            attributes: { rows: 5, autosize: true, id: 'notes' },
            children: [{ type: 'text', content: 'draft' }],
          },
        ],
        {
          resolveComponent: (tag) =>
            tag === 'Textarea'
              ? { rendersAs: visual, props: ['autosize', 'rows'] }
              : undefined,
        }
      ).markup
    ).toBe(
      [
        '<!-- component: Textarea (behavior not included) --><textarea class="field" id="notes" rows="5">draft</textarea',
        '><!-- /component -->',
      ].join('\n')
    );
  });

  it('leaves out a component it cannot resolve, and reports it', () => {
    const result = renderInstance([
      { type: 'element', tag: 'p', children: [{ type: 'text', content: 'a' }] },
      {
        type: 'element',
        tag: 'DialogDriver',
        children: [{ type: 'element', tag: 'div' }],
      },
    ]);
    expect(result.markup).toBe('<p>a</p>');
    expect(result.unresolved).toEqual(['DialogDriver']);
    expect(result.warnings[0].message).toContain(
      '<DialogDriver> is not resolved'
    );
    expect(result.warnings[0].kind).toBe('unresolved');
  });

  it('leaves out a dynamic tag whose value is a component, and reports it', () => {
    const result = renderInstance(
      {
        type: 'component',
        name: 'Box',
        props: { as: { type: 'unknown' } },
        children: [
          {
            type: 'element',
            tag: { $expression: 'as', default: 'div' },
            children: [{ type: 'text', content: 'x' }],
          },
        ],
      },
      { props: { as: () => null } }
    );
    expect(result.markup).toBe('');
    expect(result.unresolved).toEqual(['as']);
  });

  it('works out an exposed value only when the content reads it, warning then alone', () => {
    const select: Template = {
      type: 'component',
      name: 'Select',
      script: 'const api = createMachine();',
      children: [
        {
          type: 'element',
          tag: 'div',
          children: [
            {
              type: 'slot',
              exposes: { option: "'tea'", select: 'api.select', label: 'api.label' },
            },
          ],
        },
      ],
    };
    const unread = renderInstance(select, {
      children: {
        content: [{ type: 'text', expression: 'option' }],
        slotScope: ['option', 'select'],
      },
    });
    expect(unread.markup).toBe('<div>tea</div>');
    expect(unread.warnings).toEqual([]);
    const read = renderInstance(select, {
      children: {
        content: [
          { type: 'text', expression: 'option' },
          { type: 'text', expression: "select ? 'x' : ''" },
          { type: 'text', expression: 'label.text' },
        ],
        slotScope: ['option', 'select', 'label'],
      },
    });
    // A value it cannot work out reads as nothing: present, every property
    // undefined.
    expect(read.markup).toBe('<div>teax</div>');
    expect(read.warnings).toEqual([
      {
        message: 'Select: could not evaluate api.select (api is not defined)',
        kind: 'unevaluated',
      },
      {
        message: 'Select: could not evaluate api.label (api is not defined)',
        kind: 'unevaluated',
      },
    ]);
  });

  it('gives slot content passed in with scope names the values the slot exposes, and nothing for the rest', () => {
    const tabs: Template = {
      type: 'component',
      name: 'Tabs',
      props: { items: { type: 'string[]' } },
      children: [
        {
          type: 'iteration',
          items: 'items',
          item: 'item',
          children: [
            {
              type: 'element',
              tag: 'section',
              children: [
                {
                  type: 'slot',
                  name: 'panel',
                  exposes: { value: 'item', close: 'api.close' },
                },
              ],
            },
          ],
        },
      ],
    };
    const { markup } = renderInstance(tabs, {
      props: { items: ['one', 'two'] },
      slots: {
        panel: {
          content: [
            {
              type: 'element',
              tag: 'p',
              attributes: { $spread: { $expression: 'close' } },
              children: [
                { type: 'text', expression: "'showing ' + value" },
                { type: 'text', expression: "missing?.label ?? ''" },
              ],
            },
          ],
          slotScope: ['value', 'close', 'missing'],
        },
      },
    });
    expect(markup).toBe(
      [
        '<section',
        '  ><p>showing one</p',
        '></section',
        '><section',
        '  ><p>showing two</p',
        '></section>',
      ].join('\n')
    );
  });

  it('moves a hand-written component content to the template slot it fills', () => {
    const visual: Template = {
      type: 'component',
      name: 'FieldVisual',
      children: [
        {
          type: 'element',
          tag: 'div',
          children: [
            { type: 'slot', name: 'label' },
            {
              type: 'element',
              tag: 'div',
              attributes: { class: ['inner'] },
              children: [{ type: 'slot', name: 'inner' }],
            },
          ],
        },
      ],
    };
    const { markup } = renderInstance(
      [
        {
          type: 'element',
          tag: 'Field',
          slots: { label: [{ type: 'text', content: 'Name' }] },
          children: [{ type: 'element', tag: 'input' }],
        },
      ],
      {
        resolveComponent: () => ({
          rendersAs: visual,
          slots: { default: 'inner' },
        }),
      }
    );
    expect(markup).toBe(
      [
        '<!-- component: Field (behavior not included) --><div>Name<div class="inner"',
        '      ><input',
        '    ></div',
        '  ></div',
        '><!-- /component -->',
      ].join('\n')
    );
  });

  it('writes a second line break ahead of textarea and pre content that begins with one', () => {
    const { markup } = renderInstance(
      {
        type: 'component',
        name: 'Draft',
        props: { notes: { type: 'string' }, code: { type: 'string' } },
        children: [
          {
            type: 'element',
            tag: 'textarea',
            attributes: { defaultValue: { $expression: 'notes' } },
          },
          {
            type: 'element',
            tag: 'pre',
            children: [{ type: 'text', expression: 'code' }],
          },
        ],
      },
      { props: { notes: '\nkeep', code: '\n  x' } }
    );
    expect(markup).toBe('<textarea>\n\nkeep</textarea\n><pre>\n\n  x</pre>');
  });

  it('writes a form control value as markup does: a selected option, textarea text, an input value', () => {
    const { markup } = renderInstance(
      {
        type: 'component',
        name: 'Form',
        props: { role: { type: 'string' } },
        children: [
          {
            type: 'element',
            tag: 'select',
            attributes: { value: { $expression: 'role' } },
            children: [
              {
                type: 'element',
                tag: 'option',
                attributes: { value: 'admin' },
                children: [{ type: 'text', content: 'Admin' }],
              },
              {
                type: 'element',
                tag: 'option',
                attributes: { value: 'engineer' },
                children: [{ type: 'text', content: 'Engineer' }],
              },
            ],
          },
          {
            type: 'element',
            tag: 'textarea',
            attributes: { defaultValue: 'notes' },
          },
          {
            type: 'element',
            tag: 'input',
            attributes: { defaultValue: 'a', defaultChecked: true },
          },
        ],
      },
      { props: { role: 'engineer' } }
    );
    expect(markup).toBe(
      [
        '<select>',
        '  <option value="admin">Admin</option>',
        '  <option value="engineer" selected>Engineer</option>',
        '</select',
        '><textarea>notes</textarea',
        '><input checked value="a">',
      ].join('\n')
    );
  });

  it("writes an option's defaultSelected as selected, and false as nothing", () => {
    const { markup } = renderInstance(
      {
        type: 'component',
        name: 'Choice',
        props: { featured: { type: 'boolean' } },
        children: [
          {
            type: 'element',
            tag: 'option',
            attributes: { defaultSelected: { $expression: 'featured' } },
            children: [{ type: 'text', content: 'Featured' }],
          },
        ],
      },
      { props: { featured: true } }
    );
    expect(markup).toBe('<option selected>Featured</option>');
    expect(
      renderInstance(
        {
          type: 'component',
          name: 'Choice',
          props: { featured: { type: 'boolean' } },
          children: [
            {
              type: 'element',
              tag: 'option',
              attributes: { defaultSelected: { $expression: 'featured' } },
              children: [{ type: 'text', content: 'Featured' }],
            },
          ],
        },
        { props: { featured: false } }
      ).markup
    ).toBe('<option>Featured</option>');
  });

  it('reads values the caller puts in scope, which props shadow', () => {
    const template: Template = {
      type: 'component',
      name: 'Tag',
      props: { tone: { type: 'string' }, label: { type: 'string' } },
      children: [
        {
          type: 'element',
          tag: 'span',
          attributes: {
            class: [{ $expression: "'tag--' + (tone ?? fallbackTone('Tag'))" }],
          },
          children: [{ type: 'text', expression: 'label' }],
        },
      ],
    };
    const scope = { fallbackTone: () => 'calm', label: 'from scope' };
    expect(
      renderInstance(template, { props: { label: 'Hi' }, scope }).markup
    ).toBe('<span class="tag--calm">Hi</span>');
  });

  it('spreads rest and drops handlers, while authored attributes win', () => {
    expect(
      renderInstance(
        {
          type: 'component',
          name: 'Counter',
          rest: { tag: 'button' },
          children: [
            {
              type: 'element',
              tag: 'button',
              attributes: { $spread: { $expression: 'rest' }, type: 'button' },
              events: [{ name: 'click', handler: 'increment' }],
            },
          ],
        },
        { props: { type: 'submit', onClick: () => undefined, disabled: true } }
      ).markup
    ).toBe('<button type="button" disabled></button>');
  });

  it("merges the consumer's style after the root's own, so the consumer's wins", () => {
    const swatch: Template = {
      type: 'component',
      name: 'Swatch',
      props: { size: { type: 'string', default: '1rem' } },
      children: [
        {
          type: 'element',
          tag: 'span',
          passthrough: true,
          attributes: { style: { '--swatch-size': { $expression: 'size' } } },
        },
      ],
    };
    expect(
      renderInstance(swatch, {
        props: { style: '--swatch-size: 3rem; margin-top: 7px' },
      }).markup
    ).toBe(
      '<span style="--swatch-size: 1rem; --swatch-size: 3rem; margin-top: 7px"></span>'
    );
    expect(
      renderInstance(swatch, { props: { style: { marginTop: '7px' } } }).markup
    ).toBe('<span style="--swatch-size: 1rem; margin-top: 7px"></span>');
  });

  it("merges the consumer's style after a rest node's own, so the consumer's wins", () => {
    const stack: Template = {
      type: 'component',
      name: 'Stack',
      rest: { tag: 'div' },
      props: { gap: { type: 'string', default: '1rem' } },
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            $spread: { $expression: 'rest' },
            style: { '--stack-gap': { $expression: 'gap' } },
          },
        },
      ],
    };
    expect(
      renderInstance(stack, {
        props: { style: '--stack-gap: 3rem; color: red', title: 'Hi' },
      }).markup
    ).toBe(
      '<div title="Hi" style="--stack-gap: 1rem; --stack-gap: 3rem; color: red"></div>'
    );
  });

  it('stops a component that references itself without end', () => {
    const loop: Template = {
      type: 'component',
      name: 'Loop',
      children: [{ type: 'element', tag: 'Loop' }],
    };
    const result = renderInstance(loop, { resolveComponent: () => loop });
    expect(result.markup).toBe('');
    expect(result.unresolved).toEqual(['Loop']);
    expect(result.warnings[0].message).toContain(
      'nested more than 32 components deep'
    );
  });
});

describe('renderInstance generated node markers', () => {
  it('namespaces each component’s markers by its own name', () => {
    const styled = (tag: string): Template => [
      {
        type: 'element',
        tag,
        attributes: { style: { color: 'red' } },
      },
    ];
    const result = renderInstance(
      [
        {
          type: 'element',
          tag: 'span',
          attributes: { style: { color: 'blue' } },
        },
        { type: 'element', tag: 'Inner' },
      ],
      {
        componentName: 'Outer',
        resolveComponent: (tag) => (tag === 'Inner' ? styled('em') : undefined),
      }
    );
    expect(result.markup).toContain('<span data-jte-node="Outer-0"></span');
    expect(result.markup).toContain('<em data-jte-node="Inner-0"></em>');
  });
});

describe('renderInstance two-way props', () => {
  const toggle: Template = {
    type: 'component',
    name: 'Toggle',
    props: {
      pressed: {
        type: 'boolean',
        bindable: { current: 'isPressed', setter: 'setPressed', defaultProp: 'defaultPressed' },
      },
      defaultPressed: { type: 'boolean', default: false },
      value: {
        type: 'number | null',
        default: null,
        bindable: { current: 'rating', setter: 'setRating' },
      },
    },
    children: [
      {
        type: 'element',
        tag: 'button',
        attributes: {
          'aria-pressed': { $expression: 'isPressed' },
          'data-pressed': { $expression: 'pressed === undefined ? "own" : "given"' },
          'data-rating': { $expression: 'String(rating)' },
        },
        events: [{ name: 'click', handler: '() => setPressed((pressed) => !pressed)' }],
      },
    ],
  };

  it('reads the given value, else the default prop, with no warning', () => {
    const atRest = renderInstance(toggle);
    expect(atRest.markup).toBe(
      '<button aria-pressed="false" data-pressed="own" data-rating="null"></button>'
    );
    expect(atRest.warnings).toEqual([]);
    expect(renderInstance(toggle, { props: { defaultPressed: true } }).markup).toContain(
      'aria-pressed="true"'
    );
    expect(
      renderInstance(toggle, { props: { pressed: false, defaultPressed: true, value: 4 } }).markup
    ).toBe('<button aria-pressed="false" data-pressed="given" data-rating="4"></button>');
  });

  it('keeps the setter in scope, doing nothing', () => {
    const result = renderInstance({
      ...(toggle as object),
      children: [{ type: 'text', expression: 'String(setPressed(true))' }],
    } as Template);
    expect(result.markup).toBe('undefined');
    expect(result.warnings).toEqual([]);
  });
});

describe('renderInstance relayed two-way props', () => {
  const select: Template = {
    type: 'component',
    name: 'Select',
    props: {
      value: {
        type: 'string',
        bindable: { given: 'givenValue', report: 'reportValue' },
      },
      defaultValue: { type: 'string', default: 'pear' },
    },
    children: [
      {
        type: 'element',
        tag: 'button',
        attributes: {
          'data-value': { $expression: 'givenValue ?? defaultValue' },
          'data-controlled': { $expression: 'givenValue !== undefined' },
        },
        children: [{ type: 'text', expression: 'String(reportValue("fig"))' }],
      },
    ],
  };

  it('reads the given value as given, with the report function doing nothing', () => {
    const atRest = renderInstance(select);
    expect(atRest.markup).toBe(
      '<button data-value="pear" data-controlled="false">undefined</button>'
    );
    expect(atRest.warnings).toEqual([]);
    expect(renderInstance(select, { props: { value: 'apple' } }).markup).toBe(
      '<button data-value="apple" data-controlled="true">undefined</button>'
    );
  });
});

describe('renderInstance derived values', () => {
  const list: Template = {
    type: 'component',
    name: 'List',
    props: {
      items: { type: 'string[]', default: ['pear', 'apple', 'fig'] },
      query: {
        type: 'string',
        bindable: { current: 'search', setter: 'setQuery', defaultProp: 'defaultQuery' },
      },
      defaultQuery: { type: 'string', default: '' },
    },
    derived: {
      matching: 'items.filter((item) => item.includes(search))',
      sorted: '[...matching].sort()',
    },
    children: [
      {
        type: 'element',
        tag: 'ul',
        attributes: { 'data-count': { $expression: 'sorted.length' } },
        children: [
          {
            type: 'iteration',
            items: 'sorted',
            item: 'item',
            children: [
              { type: 'element', tag: 'li', children: [{ type: 'text', expression: 'item' }] },
            ],
          },
        ],
      },
    ],
  };

  /** The markup on one line, without the printer's line breaks. */
  const flat = (markup: string): string => markup.replace(/\n\s*/g, '');

  it('evaluates each derived value in order, at rest', () => {
    expect(flat(renderInstance(list).markup)).toBe(
      '<ul data-count="3"><li>apple</li><li>fig</li><li>pear</li></ul>'
    );
  });

  it('reads the given two-way value and props', () => {
    expect(flat(renderInstance(list, { props: { query: 'p' } }).markup)).toBe(
      '<ul data-count="2"><li>apple</li><li>pear</li></ul>'
    );
    expect(
      flat(renderInstance(list, { props: { items: ['b', 'a'], defaultQuery: 'a' } }).markup)
    ).toBe('<ul data-count="1"><li>a</li></ul>');
  });

  it('warns about a derived value it cannot evaluate and leaves what reads it out', () => {
    const result = renderInstance({
      ...(list as ComponentNode),
      derived: { matching: 'kitFilter(items)', sorted: '[...matching].sort()' },
    });
    expect(flat(result.markup)).toBe('<ul></ul>');
    expect(result.warnings.map((warning) => warning.message)).toEqual([
      expect.stringContaining('List: could not evaluate kitFilter(items)'),
      expect.stringContaining('List: could not evaluate [...matching].sort()'),
      expect.stringContaining('List: could not evaluate sorted.length'),
      expect.stringContaining('List: could not evaluate sorted'),
    ]);
  });

  it('calls a helper declared on the imports lines, its TypeScript types erased', () => {
    const result = renderInstance({
      ...(list as ComponentNode),
      imports: [
        "import { createContext } from 'react';",
        'export interface Named { name: string }',
        "export type { Row } from './row';",
        "export * from './shared';",
        'export const LIMIT: number = 2;',
        'export function pick<T>(items: T[], count: number = LIMIT): T[] {\n  return (items as T[]).slice(0, count);\n}',
        'const sortAll = (items: string[]): string[] => [...items].sort();',
        'export const ListContext = createContext<Named | null>(null);',
      ],
      derived: { matching: 'pick(items)', sorted: 'sortAll(matching)' },
    });
    expect(flat(result.markup)).toBe(
      '<ul data-count="2"><li>apple</li><li>pear</li></ul>'
    );
    // The context no expression reads warns about nothing.
    expect(result.warnings).toEqual([]);
  });

  it('warns, naming the declaration, when an expression reads one that could not run', () => {
    const result = renderInstance({
      ...(list as ComponentNode),
      imports: [
        "import { createContext } from 'react';",
        'const ListContext = createContext(null);',
        'function pick(items: string[]): string[] { return items.slice(0, 1); }',
      ],
      derived: { matching: 'pick(items)', sorted: 'ListContext ? matching : []' },
    });
    expect(flat(result.markup)).toBe('<ul></ul>');
    expect(result.warnings.map((warning) => warning.message)[0]).toBe(
      'List: could not evaluate ListContext ? matching : [] (ListContext on an imports line could not run: it throws (createContext is not defined))'
    );
  });

  /** A component showing one text expression, with the given imports lines. */
  const showing = (expression: string, imports: string[]): Template => ({
    type: 'component',
    name: 'Show',
    imports,
    children: [
      { type: 'element', tag: 'p', children: [{ type: 'text', expression }] },
    ],
  });

  it('fails only an expression reading a declaration that could not run, not one naming it in a string, key or parameter', () => {
    const failing = ["import { loadConfig } from 'x';", 'const config = loadConfig();'];
    for (const [expression, markup] of [
      ["['a', 'b'].map((config) => config).join()", '<p>a,b</p>'],
      ['({ config: 1 }).config', '<p>1</p>'],
      ["'config'", '<p>config</p>'],
    ]) {
      const result = renderInstance(showing(expression, failing));
      expect(result.markup).toBe(markup);
      expect(result.warnings).toEqual([]);
    }
    expect(renderInstance(showing('config.name', failing)).warnings).toHaveLength(1);
  });

  it('runs each declaration once, a function reading one declared on a later line', () => {
    const counter = globalThis as { declarationRuns?: number };
    counter.declarationRuns = 0;
    const result = renderInstance(
      showing('`${first()} ${counted}`', [
        "import { make } from 'y';",
        'const counted = (globalThis.declarationRuns++, 1);',
        'const made = make();',
        'function first(): number { return second(); }',
        'function second(): number { return 7; }',
      ])
    );
    expect(result.markup).toBe('<p>7 1</p>');
    expect(counter.declarationRuns).toBe(1);
    delete counter.declarationRuns;
  });
});

describe('renderInstance declared ids', () => {
  const field: Template = {
    type: 'component',
    name: 'Field',
    props: { id: { type: 'string' }, label: { type: 'string', required: true } },
    ids: {
      inputId: { prefix: 'field', prop: 'id' },
      hintId: 'field-hint',
    },
    derived: { describedBy: '`${hintId}`' },
    children: [
      {
        type: 'element',
        tag: 'label',
        attributes: { for: { $expression: 'inputId' } },
        children: [{ type: 'text', expression: 'label' }],
      },
      {
        type: 'element',
        tag: 'input',
        attributes: {
          id: { $expression: 'inputId' },
          'aria-describedby': { $expression: 'describedBy' },
        },
      },
    ],
  };

  it('numbers each prefix through the render, and a derived value reads the id', () => {
    const { markup, warnings } = renderInstance(
      [
        { type: 'element', tag: 'Field', attributes: { label: 'Name' } },
        { type: 'element', tag: 'Field', attributes: { label: 'Email' } },
      ],
      { resolveComponent: (tag) => (tag === 'Field' ? field : undefined) }
    );
    expect(warnings).toEqual([]);
    expect(markup).toContain('<label for="field-1">Name</label');
    expect(markup).toContain('<input id="field-1" aria-describedby="field-hint-1"');
    expect(markup).toContain('<label for="field-2">Email</label');
    expect(markup).toContain('<input id="field-2" aria-describedby="field-hint-2"');
  });

  it("takes the prop's value when the consumer gives it", () => {
    const { markup } = renderInstance(field, {
      props: { label: 'Name', id: 'name' },
    });
    expect(markup).toContain('<label for="name">Name</label');
    expect(markup).toContain('aria-describedby="field-hint-1"');
  });
});
