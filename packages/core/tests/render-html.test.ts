import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { process } from '../src/process';

function htmlOf(template: Template, options = {}): string {
  const result = process(template, options);
  const html = result.files.find((file) => file.path.endsWith('.html'));
  return html?.content ?? '';
}

describe('renderHtml', () => {
  it('renders a static element with text on one line', () => {
    expect(
      htmlOf([
        {
          type: 'element',
          tag: 'div',
          children: [{ type: 'text', content: 'Hello World' }],
        },
      ])
    ).toBe('<div>Hello World</div>\n');
  });

  it("renders a fragment's children alone, whatever wrapper a target names", () => {
    const result = process([
      {
        type: 'fragment',
        extensions: {
          react: {
            tag: 'FieldContext',
            attributes: { value: { $expression: 'id' }, class: ['context'] },
            events: [{ name: 'click', handler: 'close' }],
          },
        },
        children: [
          {
            type: 'element',
            tag: 'div',
            attributes: { 'data-part': 'field' },
            children: [{ type: 'text', content: 'Body' }],
          },
        ],
      },
    ]);
    expect(result.files[0].content).toBe(
      '<div data-part="field">Body</div>\n'
    );
    expect(result.warnings).toEqual([]);
  });

  it('escapes text content and attribute values', () => {
    expect(
      htmlOf([
        {
          type: 'element',
          tag: 'div',
          attributes: { title: 'a "b" & <c>' },
          children: [{ type: 'text', content: '1 < 2 & 3 > 2' }],
        },
      ])
    ).toBe(
      '<div title="a &quot;b&quot; &amp; &lt;c&gt;">1 &lt; 2 &amp; 3 &gt; 2</div>\n'
    );
  });

  it('renders expression placeholders for text and attributes', () => {
    expect(
      htmlOf([
        {
          type: 'element',
          tag: 'img',
          attributes: { alt: 'Avatar', src: { $expression: 'props.avatarUrl' } },
        },
        {
          type: 'element',
          tag: 'p',
          children: [{ type: 'text', expression: 'user.name' }],
        },
      ])
    ).toBe(
      '<img alt="Avatar" src="{{ props.avatarUrl }}"\n><p>{{ user.name }}</p>\n'
    );
  });

  it('renders boolean attributes as presence or absence', () => {
    expect(
      htmlOf([
        {
          type: 'element',
          tag: 'input',
          attributes: { type: 'text', disabled: true, required: false },
        },
      ])
    ).toBe('<input type="text" disabled>\n');
  });

  it('normalizes string and array class forms identically', () => {
    const arrayForm = htmlOf([
      {
        type: 'element',
        tag: 'button',
        attributes: { class: ['button', 'button--primary'], type: 'button' },
        children: [{ type: 'text', content: 'Save' }],
      },
    ]);
    const stringForm = htmlOf([
      {
        type: 'element',
        tag: 'button',
        attributes: { class: 'button button--primary', type: 'button' },
        children: [{ type: 'text', content: 'Save' }],
      },
    ]);
    expect(arrayForm).toBe(stringForm);
    expect(arrayForm).toBe(
      '<button class="button button--primary" type="button">Save</button>\n'
    );
  });

  it('renders every conditional branch between debug comments', () => {
    expect(
      htmlOf([
        {
          type: 'conditional',
          conditions: [
            {
              statement: 'if',
              condition: "status === 'loading'",
              children: [
                {
                  type: 'element',
                  tag: 'p',
                  children: [{ type: 'text', content: 'Loading' }],
                },
              ],
            },
            {
              statement: 'else-if',
              condition: "status === 'error'",
              children: [
                {
                  type: 'element',
                  tag: 'p',
                  children: [{ type: 'text', content: 'Error' }],
                },
              ],
            },
            {
              statement: 'else',
              children: [
                {
                  type: 'element',
                  tag: 'p',
                  children: [{ type: 'text', content: 'Ready' }],
                },
              ],
            },
          ],
        },
      ])
    ).toBe(
      [
        "<!-- if: status === 'loading' --><p>Loading</p",
        "><!-- else if: status === 'error' --><p>Error</p",
        '><!-- else --><p>Ready</p',
        '><!-- /if -->',
        '',
      ].join('\n')
    );
  });

  it('renders iteration children once between for comments', () => {
    expect(
      htmlOf([
        {
          type: 'element',
          tag: 'ul',
          children: [
            {
              type: 'iteration',
              items: 'props.items',
              item: 'item',
              children: [
                {
                  type: 'element',
                  tag: 'li',
                  children: [{ type: 'text', expression: 'item.label' }],
                },
              ],
            },
          ],
        },
      ])
    ).toBe(
      [
        '<ul',
        '  ><!-- for: item in props.items --><li>{{ item.label }}</li',
        '  ><!-- /for --></ul>',
        '',
      ].join('\n')
    );
  });

  it('renders slot fallbacks between slot comments', () => {
    expect(
      htmlOf([
        {
          type: 'element',
          tag: 'div',
          children: [
            {
              type: 'slot',
              name: 'header',
              fallback: [{ type: 'text', content: 'Default header' }],
            },
            { type: 'slot', exposes: { item: 'current', index: { value: 'i' } } },
          ],
        },
      ])
    ).toBe(
      [
        '<div',
        '  ><!-- slot: header -->Default header<!-- /slot --><!-- slot (exposes item = current, index = i) --></div>',
        '',
      ].join('\n')
    );
  });

  it('writes conditional attributes as a comment and keeps their CSS', () => {
    const result = process([
      {
        type: 'element',
        tag: 'div',
        attributes: { class: ['panel'] },
        conditionalAttributes: [
          {
            condition: "theme === 'dark'",
            attributes: {
              class: ['panel--dark'],
              style: { backgroundColor: '#333333' },
            },
          },
        ],
        children: [{ type: 'text', content: 'Panel' }],
      },
    ]);
    const html = result.files[0].content;
    expect(html).toContain(
      [
        '<!-- if theme === \'dark\': class="panel--dark" style="background-color: #333333" -->',
        '<div class="panel">Panel</div>',
      ].join('')
    );
    expect(html).toContain(
      '.panel--dark {\n  background-color: #333333;\n}'
    );
    expect(result.warnings).toEqual([]);
  });

  it('targets stylesheet rules at the first static class', () => {
    const html = htmlOf([
      {
        type: 'element',
        tag: 'button',
        attributes: {
          class: ['button', 'button--primary'],
          style: {
            color: 'white',
            ':hover': { backgroundColor: '#0056b3' },
            '@media (max-width: 768px)': { fontSize: '14px' },
            '.button--large &': { fontSize: '2rem' },
          },
        },
        children: [{ type: 'text', content: 'Hover me' }],
      },
    ]);
    expect(html).toContain(
      [
        '<style>',
        '.button {',
        '  color: white;',
        '}',
        '',
        '.button:hover {',
        '  background-color: #0056b3;',
        '}',
        '',
        '@media (max-width: 768px) {',
        '  .button {',
        '    font-size: 14px;',
        '  }',
        '}',
        '',
        '.button--large .button {',
        '  font-size: 2rem;',
        '}',
        '</style>',
      ].join('\n')
    );
  });

  it('marks style-bearing elements without static classes with data-jte-node', () => {
    const html = htmlOf([
      {
        type: 'element',
        tag: 'span',
        attributes: { style: { color: 'gray', ':hover': { color: 'black' } } },
        children: [{ type: 'text', content: 'No static class' }],
      },
      {
        type: 'element',
        tag: 'button',
        events: [{ name: 'click', handler: 'handleClick' }],
        children: [{ type: 'text', content: 'Click' }],
      },
    ]);
    expect(html).toContain(
      '<span data-jte-node="Component-0">No static class</span'
    );
    expect(html).toContain('<button>Click</button>');
    expect(html).toContain('[data-jte-node="Component-0"] {\n  color: gray;\n}');
    expect(html).toContain('[data-jte-node="Component-0"]:hover {\n  color: black;\n}');
  });

  it('writes events and their modifiers as comments and emits no script', () => {
    const html = htmlOf({
      type: 'component',
      name: 'Signup',
      props: { size: { type: 'number', default: 48 } },
      script: 'function handleSubmit(event) {\n  console.log(event);\n}',
      children: [
        {
          type: 'element',
          tag: 'form',
          events: [
            { name: 'submit', handler: 'handleSubmit', modifiers: ['prevent'] },
          ],
          children: [
            {
              type: 'element',
              tag: 'button',
              attributes: { type: 'submit' },
              events: [
                {
                  name: 'click',
                  handler: 'trackClick',
                  modifiers: ['stop', 'once'],
                },
              ],
              children: [{ type: 'text', content: 'Send' }],
            },
          ],
        },
      ],
    });
    expect(html).toBe(
      [
        '<!-- on submit (prevent): handleSubmit --><form',
        '  ><!-- on click (stop, once): trackClick --><button type="submit">Send</button',
        '></form>',
        '',
      ].join('\n')
    );
  });

  it('writes a component reference as comments around its projected content', () => {
    const html = htmlOf([
      {
        type: 'element',
        tag: 'Dialog',
        attributes: { open: { $expression: 'isOpen' }, size: 'small' },
        slotScope: ['api'],
        slots: {
          footer: {
            content: [{ type: 'text', content: 'Close' }],
            slotScope: ['close'],
          },
        },
        children: [{ type: 'text', content: 'Body' }],
      },
      { type: 'element', tag: 'Icon', attributes: { name: 'star' } },
    ]);
    expect(html).toBe(
      [
        '<!-- component: Dialog open="{{ isOpen }}" size="small" (scope: api) -->',
        'Body',
        '<!-- slot: footer (scope: close) -->',
        'Close',
        '<!-- /slot -->',
        '<!-- /component -->',
        '<!-- component: Icon name="star" -->',
        '\n',
      ].join('')
    );
  });

  it('writes a dynamic tag, the passthrough role and spreads as comments', () => {
    const html = htmlOf({
      type: 'component',
      name: 'Box',
      props: { as: { type: "'div' | 'section'", default: 'div' } },
      children: [
        {
          type: 'element',
          tag: { $expression: 'as', default: 'div' },
          passthrough: true,
          attributes: {
            class: ['box'],
            $spread: [{ $expression: 'rootProps' }, { $expression: 'extra' }],
          },
        },
      ],
    });
    expect(html).toBe(
      [
        '<!-- tag: as (default: div) -->',
        "<!-- passthrough: the consumer's other attributes, class and style apply here -->",
        '<!-- spread: rootProps -->',
        '<!-- spread: extra -->',
        '<div class="box"></div>',
        '\n',
      ].join('')
    );
  });

  it('names the index and key in loop comments', () => {
    expect(
      htmlOf([
        {
          type: 'iteration',
          items: 'rows',
          item: 'row',
          index: 'i',
          key: 'row.id',
          children: [{ type: 'text', expression: 'row.label' }],
        },
      ])
    ).toBe(
      '<!-- for: row, i in rows (key: row.id) -->{{ row.label }}<!-- /for -->\n'
    );
  });

  it('escapes text that would end or open a comment early', () => {
    expect(
      htmlOf([
        { type: 'comment', content: 'a --> b <!-- c --!> d' },
        {
          type: 'conditional',
          conditions: [
            {
              statement: 'if',
              condition: 'count-->0',
              children: [{ type: 'text', content: 'Some' }],
            },
          ],
        },
      ])
    ).toBe(
      [
        '<!-- a --&gt; b &lt;!-- c --!&gt; d -->',
        '<!-- if: count--&gt;0 -->',
        'Some',
        '<!-- /if -->',
        '\n',
      ].join('')
    );
  });

  it('produces pure markup for static templates', () => {
    const result = process([
      {
        type: 'element',
        tag: 'div',
        children: [{ type: 'text', content: 'Static' }],
      },
    ]);
    expect(result.files).toEqual([
      { path: 'Component.html', content: '<div>Static</div>\n' },
    ]);
    expect(result.warnings).toEqual([]);
  });

  describe('bound boolean attributes', () => {
    const markupOf = (
      tag: string,
      attributes: Record<string, unknown>
    ): string =>
      htmlOf([{ type: 'element', tag, attributes }] as Template).split(
        '\n'
      )[0];

    it('writes a boolean bound on its element as an if comment', () => {
      expect(markupOf('button', { disabled: { $expression: 'busy' } })).toBe(
        '<!-- if busy: disabled --><button></button>'
      );
      expect(markupOf('div', { hidden: { $expression: 'closed' } })).toBe(
        '<!-- if closed: hidden --><div></div>'
      );
    });

    it('leaves an attribute that is not boolean on its element, or on a custom element, a value', () => {
      expect(markupOf('div', { open: { $expression: 'open' } })).toBe(
        '<div open="{{ open }}"></div>'
      );
      expect(markupOf('img', { default: { $expression: 'first' } })).toBe(
        '<img default="{{ first }}">'
      );
      expect(markupOf('my-panel', { open: { $expression: 'open' } })).toBe(
        '<my-panel open="{{ open }}"></my-panel>'
      );
    });

    it('writes a DOM property with no attribute as a property comment', () => {
      expect(
        markupOf('input', {
          type: 'checkbox',
          indeterminate: { $expression: 'mixed' },
        })
      ).toBe('<!-- property indeterminate: mixed --><input type="checkbox">');
      expect(markupOf('input', { indeterminate: true })).toBe(
        '<!-- property indeterminate: true --><input>'
      );
      expect(markupOf('input', { indeterminate: false })).toBe('<input>');
      // On another element, or a custom one, it is an attribute like any.
      expect(markupOf('my-box', { indeterminate: { $expression: 'mixed' } })).toBe(
        '<my-box indeterminate="{{ mixed }}"></my-box>'
      );
      expect(
        htmlOf([
          {
            type: 'element',
            tag: 'input',
            attributes: { type: 'checkbox' },
            conditionalAttributes: [
              { condition: 'open', attributes: { indeterminate: { $expression: 'mixed' } } },
              { condition: 'partial', attributes: { indeterminate: true, title: 'Some' } },
            ],
          },
        ] as Template).split('\n')[0]
      ).toBe(
        '<!-- property indeterminate: open && mixed --><!-- if partial: title="Some" --><!-- property indeterminate: partial --><input type="checkbox">'
      );
    });

    it('reads a bound checked beside a bound defaultChecked in one comment', () => {
      expect(
        markupOf('input', {
          type: 'checkbox',
          checked: { $expression: 'checked' },
          defaultChecked: { $expression: 'defaultChecked' },
        })
      ).toBe(
        '<!-- if checked ?? defaultChecked: checked --><input type="checkbox">'
      );
    });
  });

  describe('form control defaults', () => {
    it('writes a bound boolean default as an if comment, a static one as the attribute', () => {
      expect(
        htmlOf([
          {
            type: 'element',
            tag: 'input',
            attributes: {
              type: 'checkbox',
              defaultChecked: { $expression: 'on' },
            },
          },
          {
            type: 'element',
            tag: 'input',
            attributes: { type: 'checkbox', defaultChecked: false },
          },
        ])
      ).toBe(
        [
          '<!-- if on: checked --><input type="checkbox"',
          '><input type="checkbox">',
          '',
        ].join('\n')
      );
    });

    it("writes an input's defaultValue as value, after a bound value", () => {
      expect(
        htmlOf([
          {
            type: 'element',
            tag: 'input',
            attributes: { defaultValue: 'a' },
          },
          {
            type: 'element',
            tag: 'input',
            attributes: {
              defaultValue: 'b',
              value: { $expression: 'current' },
            },
          },
          {
            type: 'element',
            tag: 'input',
            attributes: { value: 'c', defaultValue: { $expression: 'other' } },
          },
        ])
      ).toBe(
        [
          '<input value="a"',
          '><input value="{{ current ?? \'b\' }}"',
          '><input value="c">',
          '',
        ].join('\n')
      );
    });

    it('writes a second line break ahead of pre and textarea content that begins with one', () => {
      expect(
        htmlOf([
          {
            type: 'element',
            tag: 'pre',
            children: [{ type: 'text', content: '\n  keep  spaces' }],
          },
          {
            type: 'element',
            tag: 'textarea',
            attributes: { defaultValue: '\nDraft' },
          },
          {
            type: 'element',
            tag: 'pre',
            children: [
              { type: 'text', content: '\n' },
              { type: 'element', tag: 'code', children: [{ type: 'text', content: 'x' }] },
            ],
          },
          {
            type: 'element',
            tag: 'pre',
            children: [{ type: 'text', content: 'no break' }],
          },
        ])
      ).toBe(
        [
          '<pre>\n\n  keep  spaces</pre',
          '><textarea>\n\nDraft</textarea',
          '><pre>\n\n<code>x</code></pre',
          '><pre>no break</pre>',
          '',
        ].join('\n')
      );
    });

    it("writes a textarea's defaultValue as its text", () => {
      expect(
        htmlOf([
          {
            type: 'element',
            tag: 'textarea',
            attributes: { defaultValue: { $expression: 'notes' } },
          },
        ])
      ).toBe('<textarea>{{ notes }}</textarea>\n');
    });

    it("reads a select's and a textarea's value before their default, keeping no value attribute", () => {
      expect(
        htmlOf([
          {
            type: 'element',
            tag: 'textarea',
            attributes: {
              value: { $expression: 'notes' },
              defaultValue: 'none',
            },
          },
          {
            type: 'element',
            tag: 'select',
            attributes: { value: { $expression: 'role' }, defaultValue: 'b' },
            children: [
              {
                type: 'element',
                tag: 'option',
                attributes: { value: 'b' },
                children: [{ type: 'text', content: 'B' }],
              },
            ],
          },
        ])
      ).toBe(
        [
          "<textarea>{{ notes ?? 'none' }}</textarea",
          '><select>',
          "  <!-- if 'b' === (role ?? 'b'): selected -->",
          '  <option value="b">B</option>',
          '</select>',
          '',
        ].join('\n')
      );
    });

    it('names default-value properties as their attributes in conditional entries', () => {
      expect(
        htmlOf([
          {
            type: 'element',
            tag: 'input',
            conditionalAttributes: [
              { condition: 'on', attributes: { defaultChecked: true } },
            ],
          },
          {
            type: 'element',
            tag: 'select',
            conditionalAttributes: [
              { condition: 'on', attributes: { defaultValue: 'b' } },
            ],
          },
        ])
      ).toBe(
        [
          '<!-- if on: checked --><input',
          '><!-- if on: value="b" --><select></select>',
          '',
        ].join('\n')
      );
    });

    it("marks the option a select's defaultValue matches", () => {
      expect(
        htmlOf([
          {
            type: 'element',
            tag: 'select',
            attributes: { defaultValue: 'b' },
            children: [
              {
                type: 'element',
                tag: 'option',
                attributes: { value: 'a' },
                children: [{ type: 'text', content: 'A' }],
              },
              {
                type: 'element',
                tag: 'option',
                children: [{ type: 'text', content: 'b' }],
              },
            ],
          },
          {
            type: 'element',
            tag: 'select',
            attributes: { defaultValue: { $expression: 'role' } },
            children: [
              {
                type: 'iteration',
                items: 'roles',
                item: 'entry',
                children: [
                  {
                    type: 'element',
                    tag: 'option',
                    attributes: { value: { $expression: 'entry.id' } },
                    children: [{ type: 'text', expression: 'entry.label' }],
                  },
                ],
              },
            ],
          },
        ])
      ).toBe(
        [
          '<select>',
          '  <option value="a">A</option>',
          '  <option selected>b</option>',
          '</select',
          '><select>',
          '  <!-- for: entry in roles -->',
          '  <!-- if entry.id === role: selected -->',
          '  <option value="{{ entry.id }}">{{ entry.label }}</option>',
          '  <!-- /for -->',
          '</select>',
          '',
        ].join('\n')
      );
    });
  });

  describe('output strategies', () => {
    const template: Template = {
      type: 'component',
      name: 'Badge',
      children: [
        {
          type: 'element',
          tag: 'span',
          attributes: {
            class: ['badge'],
            style: { color: 'white', backgroundColor: 'crimson' },
          },
          children: [{ type: 'text', content: 'New' }],
        },
      ],
    };

    it('inline renders style attributes', () => {
      const result = process(template, {
        styling: { placement: 'inline' },
      });
      expect(result.files.map((file) => file.path)).toEqual(['Badge.html']);
      expect(result.files[0].content).toBe(
        '<span class="badge" style="color: white; background-color: crimson">New</span>\n'
      );
    });

    it('separate-file emits a css file referenced from the html', () => {
      const result = process(template, {
        styling: { placement: 'separate-file' },
      });
      expect(result.files.map((file) => file.path)).toEqual([
        'Badge.html',
        'Badge.css',
      ]);
      expect(result.files[0].content).toContain(
        '<link rel="stylesheet" href="Badge.css">'
      );
      expect(result.files[1].content).toBe(
        '.badge {\n  color: white;\n  background-color: crimson;\n}\n'
      );
    });

    it('stylesheetLink none emits the stylesheet without the link element', () => {
      const result = process(template, {
        styling: {
          placement: 'separate-file',
          stylesheetLink: 'none',
        },
      });
      expect(result.files.map((file) => file.path)).toEqual([
        'Badge.html',
        'Badge.css',
      ]);
      const html = result.files[0].content;
      expect(html).not.toContain('<link');
      expect(html).not.toContain('<style>');
      expect(result.files[1].content).toBe(
        '.badge {\n  color: white;\n  background-color: crimson;\n}\n'
      );
    });

    it('rejects stylesheetLink none without the separate-file strategy', () => {
      expect(() =>
        process(template, {
          styling: { placement: 'in-file', stylesheetLink: 'none' },
        })
      ).toThrow(/requires the 'separate-file' stylesheet placement/);
      expect(() =>
        process(template, {
          styling: { placement: 'inline', stylesheetLink: 'none' },
        })
      ).toThrow(/there is no separate stylesheet to leave unlinked/);
    });
  });
});

describe('renderHtml two-way props', () => {
  it('names where each two-way value comes from at the head of the markup', () => {
    expect(
      htmlOf({
        type: 'component',
        name: 'Toggle',
        props: {
          pressed: {
            type: 'boolean',
            bindable: { current: 'isPressed', setter: 'setPressed', defaultProp: 'defaultPressed' },
          },
          defaultPressed: { type: 'boolean', default: false },
          value: { type: 'string', default: 'a', bindable: { current: 'current', setter: 'setValue' } },
        },
        children: [{ type: 'element', tag: 'span', attributes: { 'aria-pressed': { $expression: 'isPressed' } } }],
      })
    ).toBe(
      [
        '<!-- isPressed: pressed, else defaultPressed -->',
        "<!-- current: value, else 'a' -->",
        '<span aria-pressed="{{ isPressed }}"></span>',
        '',
      ].join('\n')
    );
  });
});

describe('renderHtml derived values', () => {
  it('names each derived value and its expression at the head, after the two-way values', () => {
    expect(
      htmlOf({
        type: 'component',
        name: 'Counter',
        props: {
          count: { type: 'number', default: 0, bindable: { current: 'current', setter: 'setCount' } },
          max: { type: 'number', default: 3 },
        },
        derived: {
          remaining: 'max -\n  current',
          full: 'remaining === 0',
        },
        children: [{ type: 'element', tag: 'output', children: [{ type: 'text', expression: 'remaining' }] }],
      })
    ).toBe(
      [
        '<!-- current: count, else 0 -->',
        '<!-- remaining = max - current -->',
        '<!-- full = remaining === 0 -->',
        '<output>{{ remaining }}</output>',
        '',
      ].join('\n')
    );
  });
});

describe('renderHtml declared ids', () => {
  it('names each id at the head and writes its value where an expression reads only ids', () => {
    expect(
      htmlOf({
        type: 'component',
        name: 'Disclosure',
        props: { id: { type: 'string' }, open: { type: 'boolean', default: false } },
        ids: {
          panelId: 'disclosure-panel',
          buttonId: { prefix: 'disclosure-button', prop: 'id' },
        },
        children: [
          {
            type: 'element',
            tag: 'button',
            attributes: {
              id: { $expression: 'buttonId' },
              'aria-controls': { $expression: 'panelId' },
              'aria-expanded': { $expression: 'open' },
            },
          },
          {
            type: 'element',
            tag: 'div',
            attributes: {
              id: { $expression: 'panelId' },
              'aria-labelledby': { $expression: '`${buttonId}`' },
              'data-state': { $expression: "open ? panelId : 'closed'" },
            },
            children: [{ type: 'text', expression: '`${panelId}-text`' }],
          },
        ],
      })
    ).toBe(
      [
        "<!-- panelId = 'disclosure-panel-1' (an id per instance) -->",
        "<!-- buttonId = id ?? 'disclosure-button-1' (an id per instance) -->",
        '<button id="disclosure-button-1" aria-controls="disclosure-panel-1" aria-expanded="{{ open }}"></button',
        `><div id="disclosure-panel-1" aria-labelledby="disclosure-button-1" data-state="{{ open ? panelId : 'closed' }}">disclosure-panel-1-text</div>`,
        '',
      ].join('\n')
    );
  });
});
