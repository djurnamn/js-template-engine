import { process } from '@js-template-engine/core';
import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { templateGlobals } from '../src/globals';
import { vue } from '../src/index';

function render(template: Template) {
  return process(template, { extensions: [vue()] });
}

describe('templateGlobals', () => {
  it('finds the browser globals an expression reads, in first-read order', () => {
    expect(
      templateGlobals(
        [
          '() => { document.getElementById(`${prefix}-tab`)?.focus(); }',
          'navigator.language',
          '`${window.location.href}`',
        ],
        new Set()
      )
    ).toEqual({ declared: ['document', 'navigator', 'window'], reported: [] });
  });

  it('reads element and event constructors, but not a type after as or satisfies', () => {
    expect(
      templateGlobals(
        [
          '(event) => event.target instanceof HTMLInputElement',
          '(event) => (event.target as HTMLSelectElement).value',
          '() => dispatch(new CustomEvent("open"))',
        ],
        new Set()
      ).declared
    ).toEqual(['HTMLInputElement', 'CustomEvent']);
  });

  it('leaves out every name of a type after as or satisfies, up to where the type ends', () => {
    expect(
      templateGlobals(
        [
          '(event) => { const next = (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value; emit(next); }',
          '(event) => (event.target as Array<HTMLElement>)[0] ?? document.body',
          'items satisfies Record<string, Event> ? window.name : ""',
        ],
        new Set()
      ).declared
    ).toEqual(['document', 'window']);
  });

  it('leaves out what is not a free reference to a global', () => {
    expect(
      templateGlobals(
        [
          // A parameter, a member-access tail and an object key.
          '(document) => document.title',
          'state.window',
          '{ location: 1 }',
          // A name Vue already sees, and one that may be a global property.
          'Math.max(1, 2) + console.log(1) + translate("key")',
        ],
        new Set()
      ).declared
    ).toEqual([]);
  });

  it('leaves out a name the component binds', () => {
    expect(
      templateGlobals(
        ['history.length', 'document.title'],
        new Set(['history'])
      ).declared
    ).toEqual(['document']);
  });

  it('reports a global whose value changes with the page', () => {
    expect(
      templateGlobals(['scrollY > 0', 'globalThis.name'], new Set())
    ).toEqual({ declared: [], reported: ['scrollY', 'globalThis'] });
  });
});

describe('vue() browser globals in the template', () => {
  const template: Template = {
    type: 'component',
    name: 'Tabs',
    props: { location: { type: 'string' }, items: { type: 'string[]' } },
    script: 'const history: string[] = [];',
    children: [
      {
        type: 'element',
        tag: 'div',
        attributes: {
          title: { $expression: 'location + history.length' },
          lang: { $expression: 'navigator.language' },
        },
        events: [
          {
            name: 'keydown',
            handler: '() => document.getElementById("tab")?.focus()',
          },
        ],
        children: [
          {
            type: 'iteration',
            items: 'items',
            item: 'self',
            key: 'self',
            children: [{ type: 'text', expression: 'self' }],
          },
        ],
      },
    ],
  };

  it('declares each global the template reads in <script setup>, ahead of the script', () => {
    const content = render(template).files[0].content;
    expect(content).toContain(
      'const navigator = globalThis.navigator;\nconst document = globalThis.document;\n\nconst history: string[] = [];'
    );
  });

  it('leaves a prop, a script declaration and a template local alone', () => {
    const content = render(template).files[0].content;
    expect(content).not.toContain('globalThis.location');
    expect(content).not.toContain('globalThis.history');
    expect(content).not.toContain('globalThis.self');
  });

  it('declares a global a sibling loop shadows only inside itself', () => {
    const content = render({
      type: 'component',
      name: 'Documents',
      props: { docs: { type: 'string[]' } },
      children: [
        {
          type: 'element',
          tag: 'button',
          events: [{ name: 'click', handler: '() => document.body.focus()' }],
        },
        {
          type: 'iteration',
          items: 'docs',
          item: 'document',
          key: 'document',
          children: [{ type: 'text', expression: 'document' }],
        },
      ],
    }).files[0].content;
    expect(content).toContain('const document = globalThis.document;');
  });

  it('reads the source a loop iterates outside the loop item', () => {
    const content = render({
      type: 'component',
      name: 'Forms',
      children: [
        {
          type: 'iteration',
          items: 'document.forms',
          item: 'document',
          children: [{ type: 'text', expression: 'document.id' }],
        },
      ],
    }).files[0].content;
    expect(content).toContain('const document = globalThis.document;');
  });

  it('binds a window function to the global', () => {
    const content = render({
      type: 'component',
      name: 'Later',
      children: [
        {
          type: 'element',
          tag: 'button',
          events: [
            { name: 'click', handler: '() => setTimeout(() => print(), 10)' },
          ],
        },
      ],
    }).files[0].content;
    expect(content).toContain(
      'const setTimeout = globalThis.setTimeout?.bind(globalThis);\nconst print = globalThis.print?.bind(globalThis);'
    );
  });

  it('reads a directive a Vue override writes as a plain attribute', () => {
    const content = render({
      type: 'component',
      name: 'Titled',
      children: [
        {
          type: 'element',
          tag: 'div',
          extensions: {
            vue: {
              attributes: { ':title': 'document.title', 'data-x': 'window' },
            },
          },
        },
      ],
    }).files[0].content;
    expect(content).toContain('const document = globalThis.document;');
    expect(content).not.toContain('globalThis.window');
  });

  it('declares nothing when the template reads no global', () => {
    const content = render({
      type: 'component',
      name: 'Plain',
      children: [{ type: 'text', expression: 'Math.round(1.5)' }],
    }).files[0].content;
    expect(content).not.toContain('globalThis');
  });

  it('warns about a global whose value changes with the page', () => {
    const result = render({
      type: 'component',
      name: 'Header',
      children: [
        {
          type: 'element',
          tag: 'header',
          attributes: { 'data-scrolled': { $expression: 'scrollY > 0' } },
        },
      ],
    });
    expect(result.warnings).toContainEqual({
      message:
        "The Vue template reads the browser global 'scrollY', which a Vue template cannot see; read it as 'window.scrollY' or from a script function",
    });
    expect(result.files[0].content).not.toContain('globalThis.scrollY');
  });
});
