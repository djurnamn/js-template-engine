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
      '<img alt="Avatar" src="{{ props.avatarUrl }}">\n<p>{{ user.name }}</p>\n'
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
        "<!-- if: status === 'loading' -->",
        '<p>Loading</p>',
        "<!-- else if: status === 'error' -->",
        '<p>Error</p>',
        '<!-- else -->',
        '<p>Ready</p>',
        '<!-- /if -->',
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
        '<ul>',
        '  <!-- for: item in props.items -->',
        '  <li>{{ item.label }}</li>',
        '  <!-- /for -->',
        '</ul>',
        '',
      ].join('\n')
    );
  });

  it('renders slot fallbacks in place', () => {
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
          ],
        },
      ])
    ).toBe('<div>\n  Default header\n</div>\n');
  });

  it('omits conditional attributes from markup with a warning but keeps their CSS', () => {
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
    expect(html).toContain('<div class="panel">Panel</div>');
    expect(html).not.toContain('panel--dark"');
    expect(html).toContain(
      '.panel--dark {\n  background-color: #333333;\n}'
    );
    expect(result.warnings).toEqual([
      {
        message: 'Conditional attributes are not applied in static HTML output',
        nodePath: '[0]',
      },
    ]);
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

  it('marks selector-needing elements without static classes with data-jte-node', () => {
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
      '<span data-jte-node="0">No static class</span>'
    );
    expect(html).toContain('<button data-jte-node="1">Click</button>');
    expect(html).toContain('[data-jte-node="0"] {\n  color: gray;\n}');
    expect(html).toContain('[data-jte-node="0"]:hover {\n  color: black;\n}');
    expect(html).toContain(
      'document.querySelector(\'[data-jte-node="1"]\').addEventListener(\'click\', handleClick);'
    );
  });

  it('wraps modifier-bearing listeners and maps once to listener options', () => {
    const html = htmlOf([
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
    ]);
    expect(html).toContain(
      [
        'document.querySelector(\'[data-jte-node="0"]\').addEventListener(\'submit\', function (event) {',
        '  event.preventDefault();',
        '  handleSubmit(event);',
        '});',
      ].join('\n')
    );
    expect(html).toContain(
      [
        'document.querySelector(\'[data-jte-node="1"]\').addEventListener(\'click\', function (event) {',
        '  event.stopPropagation();',
        '  trackClick(event);',
        '}, { once: true });',
      ].join('\n')
    );
  });

  it('renders prop defaults as consts and component script content', () => {
    const html = htmlOf({
      type: 'component',
      name: 'Avatar',
      props: {
        imageUrl: { type: 'string', required: true },
        size: { type: 'number', default: 48 },
        rounded: { type: 'boolean', default: true },
      },
      script: 'function focus(event) {\n  console.log(event);\n}',
      children: [
        {
          type: 'element',
          tag: 'img',
          attributes: { alt: 'Avatar', src: { $expression: 'imageUrl' } },
        },
      ],
    });
    expect(html).toContain(
      [
        '<script>',
        'const size = 48;',
        'const rounded = true;',
        '',
        'function focus(event) {',
        '  console.log(event);',
        '}',
        '</script>',
      ].join('\n')
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

  it('warns about component imports, which HTML output cannot include', () => {
    const result = process({
      type: 'component',
      name: 'Alert',
      imports: ["import { palette } from './palette';"],
      children: [
        {
          type: 'element',
          tag: 'div',
          children: [{ type: 'text', content: 'Alert' }],
        },
      ],
    });
    expect(result.files[0].content).not.toContain('import');
    expect(result.warnings).toEqual([
      {
        message: 'Import statements are not included in HTML output',
        nodePath: 'imports',
      },
    ]);
  });

  describe('output strategies', () => {
    const template: Template = {
      type: 'component',
      name: 'Badge',
      script: 'function handleClick(event) {\n  console.log(event);\n}',
      children: [
        {
          type: 'element',
          tag: 'span',
          attributes: {
            class: ['badge'],
            style: { color: 'white', backgroundColor: 'crimson' },
          },
          events: [{ name: 'click', handler: 'handleClick' }],
          children: [{ type: 'text', content: 'New' }],
        },
      ],
    };

    it('inline renders style and handler attributes', () => {
      const result = process(template, {
        styling: { outputStrategy: 'inline' },
        scripting: { outputStrategy: 'inline' },
      });
      expect(result.files.map((file) => file.path)).toEqual(['Badge.html']);
      const html = result.files[0].content;
      expect(html).toContain(
        '<span class="badge" style="color: white; background-color: crimson" onclick="handleClick(event)">New</span>'
      );
      expect(html).not.toContain('<style>');
      expect(html).toContain('<script>\nfunction handleClick(event)');
    });

    it('separate-file emits css and js files referenced from the html', () => {
      const result = process(template, {
        styling: { outputStrategy: 'separate-file' },
        scripting: { outputStrategy: 'separate-file' },
      });
      expect(result.files.map((file) => file.path)).toEqual([
        'Badge.html',
        'Badge.css',
        'Badge.js',
      ]);
      const html = result.files[0].content;
      expect(html).toContain('<link rel="stylesheet" href="Badge.css">');
      expect(html).toContain('<script src="Badge.js"></script>');
      expect(result.files[1].content).toBe(
        '.badge {\n  color: white;\n  background-color: crimson;\n}\n'
      );
      expect(result.files[2].content).toContain(
        "document.querySelector('.badge').addEventListener('click', handleClick);"
      );
    });

    it('inline wraps non-identifier handlers as invoked function expressions', () => {
      const result = process(
        [
          {
            type: 'element',
            tag: 'button',
            events: [{ name: 'click', handler: '() => save()' }],
            children: [{ type: 'text', content: 'Save' }],
          },
        ],
        { scripting: { outputStrategy: 'inline' } }
      );
      expect(result.files[0].content).toContain(
        'onclick="(() =&gt; save())(event)"'
      );
    });

    it('inline warns on capture and passive modifiers', () => {
      const result = process(
        [
          {
            type: 'element',
            tag: 'div',
            events: [
              { name: 'scroll', handler: 'onScroll', modifiers: ['passive'] },
            ],
          },
        ],
        { scripting: { outputStrategy: 'inline' } }
      );
      expect(result.warnings).toEqual([
        {
          message:
            "The 'passive' modifier cannot be applied with inline event handlers",
          nodePath: '[0].events[0]',
        },
      ]);
    });
  });
});
