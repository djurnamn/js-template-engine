import { process, type StylingExtension } from '@js-template-engine/core';
import type {
  Attributes,
  EventDefinition,
  Template,
} from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { vue } from '../src/index';

/** A minimal BEM runtime-mode styling extension: a `bem(...)` call on each span. */
const runtimeBem: StylingExtension = {
  key: 'bem',
  kind: 'styling',
  classKind: 'semantic',
  runtime: {
    importSource: 'use-bem',
    elementSeparator: '__',
    modifierSeparator: '--',
    call: (element) =>
      element.tag === 'span'
        ? {
            block: 'Badge',
            declaresBlock: true,
            elementName: undefined,
            staticModifiers: [],
            conditionalModifiers: [],
            contributedClasses: ['Badge'],
            foldedConditionalClasses: [],
          }
        : undefined,
  },
  contributeClasses: (element) => (element.tag === 'span' ? ['Badge'] : []),
};

function processWithVue(
  template: Template,
  options: Parameters<typeof process>[1] = {}
) {
  return process(template, { ...options, extensions: [vue()] });
}

function fileContent(
  template: Template,
  options: Parameters<typeof process>[1] = {}
) {
  return processWithVue(template, options).files[0].content;
}

/** A passthrough label routing only aria-* to its input. */
const ROUTED_ARIA: Template = {
  type: 'component',
  name: 'Field',
  props: {
    hint: { type: 'string' },
    label: { type: 'string' },
    inputId: { type: 'string' },
    onPress: { type: '() => void' },
    onFocusIn: { type: '() => void' },
  },
  children: [
    {
      type: 'element',
      tag: 'label',
      passthrough: true,
      attributes: { title: { $expression: 'hint' } },
      events: [{ name: 'click', handler: 'onPress' }],
      children: [
        {
          type: 'element',
          tag: 'input',
          passthrough: { attributes: ['aria-*'] },
          attributes: {
            id: { $expression: 'inputId' },
            'aria-label': { $expression: 'label' },
          },
          events: [{ name: 'focus', handler: 'onFocusIn' }],
        },
      ],
    },
  ],
};

/** {@link ROUTED_ARIA} with its input setting `passthrough` to `routing`. */
function routedWith(
  routing: Record<string, unknown>,
  inputAttributes: Record<string, unknown> = {}
): Template {
  const template = structuredClone(ROUTED_ARIA) as Extract<
    Template,
    { type: 'component' }
  >;
  const label = template.children[0] as unknown as {
    children: Array<Record<string, unknown>>;
  };
  const input = label.children[0];
  input.passthrough = routing;
  input.attributes = {
    ...(input.attributes as Record<string, unknown>),
    ...inputAttributes,
  };
  return template;
}

/** {@link ROUTED_ARIA} whose input sets `aria-describedby` only while `hint` is set. */
function routedConditional(): Template {
  const template = routedWith({ attributes: ['aria-*'] });
  const input = (
    (template as Extract<Template, { type: 'component' }>)
      .children[0] as unknown as { children: Array<Record<string, unknown>> }
  ).children[0];
  input.conditionalAttributes = [
    { condition: 'hint', attributes: { 'aria-describedby': 'field-hint' } },
  ];
  return template;
}

describe('vue()', () => {
  it('binds and falls back against the share each name lands in', () => {
    const content = fileContent(ROUTED_ARIA);
    expect(content).toContain(`v-bind="consumerAttributes($attrs, 'root')"`);
    expect(content).toContain(`v-bind="consumerAttributes($attrs, 'routed')"`);
    expect(content).toContain(
      `:title="authoredOrConsumer(hint, $attrs, 'title')"`
    );
    expect(content).toContain(
      `:aria-label="authoredOrConsumer(label, $attrs, 'aria-label')"`
    );
    expect(content).toContain(':id="inputId"');
  });

  it("exposes the routed element as $el and element with handle: 'routed'", () => {
    const content = fileContent(
      routedWith({ attributes: ['aria-*'], handle: 'routed' })
    );
    expect(content).toContain("import { shallowRef } from 'vue';");
    expect(content).toContain(
      "const routedElement = shallowRef<HTMLElementTagNameMap['input'] | null>(null);\nconst vRoutedElement = {"
    );
    expect(content).toContain(
      'defineExpose({ $el: routedElement, element: routedElement });'
    );
    // An element unmounting after a newer one mounted leaves the newer one.
    expect(content).toContain(
      'if (routedElement.value === element) {\n      routedElement.value = null;'
    );
    expect(content).toContain(
      `v-bind="consumerAttributes($attrs, 'routed')"\n      v-routed-element`
    );
    // A directive, so a ref the template sets on the element stays its own.
    const authoredReference = routedWith({
      attributes: ['aria-*'],
      handle: 'routed',
    }) as Extract<Template, { type: 'component' }>;
    const input = (
      authoredReference.children[0] as unknown as {
        children: Array<Record<string, unknown>>;
      }
    ).children[0];
    input.extensions = { vue: { attributes: { ref: 'inputElement' } } };
    const withReference = fileContent(authoredReference);
    expect(withReference).toContain('ref="inputElement"');
    expect(withReference).toContain('v-routed-element');
    expect(withReference.match(/ref="/g)).toHaveLength(1);
    // The default keeps Vue's own $el, the root.
    expect(
      fileContent(routedWith({ attributes: ['aria-*'], handle: 'root' }))
    ).toBe(fileContent(ROUTED_ARIA));
  });

  it("merges $el and element into the author's own defineExpose", () => {
    for (const [script, expected] of [
      [
        'const focus = () => undefined;\ndefineExpose({ focus });',
        'defineExpose({ focus, $el: routedElement, element: routedElement });',
      ],
      [
        'defineExpose();',
        'defineExpose({ $el: routedElement, element: routedElement });',
      ],
      [
        'defineExpose({});',
        'defineExpose({ $el: routedElement, element: routedElement });',
      ],
      // A spread may carry an element of its own, which wins.
      [
        'const api = { focus: () => undefined };\ndefineExpose(api);',
        'defineExpose({ ...{ element: routedElement }, ...api, $el: routedElement });',
      ],
      [
        'const api = { focus: () => undefined };\ndefineExpose({ ...api, blur() {} });',
        'defineExpose({ ...{ element: routedElement }, ...api, blur() {}, $el: routedElement });',
      ],
      [
        "defineExpose({\n  label: ')',\n});",
        "defineExpose({\n  label: ')', $el: routedElement, element: routedElement });",
      ],
      // A trailing line comment stays a comment, after the merged keys.
      [
        'const focus = () => undefined;\ndefineExpose({\n  focus, // focus it\n});',
        'defineExpose({\n  focus, $el: routedElement, element: routedElement // focus it\n});',
      ],
      [
        'const api = { focus: () => undefined };\ndefineExpose(api /* the API */);',
        'defineExpose({ ...{ element: routedElement }, ...api, $el: routedElement } /* the API */);',
      ],
      // A generic type argument, and a defineExpose( in a comment or string.
      [
        "// defineExpose( comes last\nconst label = 'defineExpose(';\nconst focus = () => undefined;\ndefineExpose({ focus });",
        "// defineExpose( comes last\nconst label = 'defineExpose(';\nconst focus = () => undefined;\ndefineExpose({ focus, $el: routedElement, element: routedElement });",
      ],
      // A quote in a regular expression opens no string; division is not one.
      [
        "const quote = /'/;\nconst focus = () => quote;\ndefineExpose({ focus });",
        'defineExpose({ focus, $el: routedElement, element: routedElement });',
      ],
      [
        "const quotes = /[\"'/]/g;\nconst focus = () => quotes;\ndefineExpose({ focus, pattern: /'/ });",
        "defineExpose({ focus, pattern: /'/, $el: routedElement, element: routedElement });",
      ],
      [
        "const a = 6, b = 3, c = 2;\nconst ratio = a / b / c; // 'one'\ndefineExpose({ ratio });",
        'defineExpose({ ratio, $el: routedElement, element: routedElement });',
      ],
      // A type argument gains the two keys, typed as the ref.
      [
        'const focus = () => undefined;\ndefineExpose<{ focus: () => void }>({ focus });',
        'defineExpose<({ focus: () => void }) & { $el: typeof routedElement; element: typeof routedElement }>({ focus, $el: routedElement, element: routedElement });',
      ],
      // A key merely containing the word is not an element of its own.
      [
        "defineExpose({ elements: [], label: 'element' });",
        "defineExpose({ elements: [], label: 'element', $el: routedElement, element: routedElement });",
      ],
    ]) {
      const template = routedWith({
        attributes: ['aria-*'],
        handle: 'routed',
      }) as Extract<Template, { type: 'component' }>;
      template.extensions = { vue: { script } };
      const content = fileContent(template);
      expect(content).toContain(expected);
      expect(content.match(/\$el: routedElement/g)).toHaveLength(1);
    }
  });

  it('never emits a second defineExpose when the call cannot be read', () => {
    const template = routedWith({
      attributes: ['aria-*'],
      handle: 'routed',
    }) as Extract<Template, { type: 'component' }>;
    // An unclosed call, and one an unterminated string hides from the scan.
    for (const script of [
      'defineExpose({ focus: () => 1 ',
      "const label = 'open;\ndefineExpose({ label });",
    ]) {
      template.extensions = { vue: { script } };
      const result = processWithVue(template);
      expect(result.files[0].content.match(/defineExpose/g)).toHaveLength(1);
      expect(result.warnings).toContainEqual({
        message: expect.stringContaining('the call could not be read'),
        nodePath: 'extensions.vue.script',
      });
    }
  });

  it("keeps an element the author's defineExpose names, and warns", () => {
    for (const [script, expected] of [
      [
        'const element = 1;\ndefineExpose({ element });',
        'defineExpose({ element, $el: routedElement });',
      ],
      [
        "defineExpose({ 'element': 1 });",
        "defineExpose({ 'element': 1, $el: routedElement });",
      ],
      [
        "defineExpose({ ['element']: 1 });",
        "defineExpose({ ['element']: 1, $el: routedElement });",
      ],
      [
        'defineExpose({ get element() { return 1; } });',
        'defineExpose({ get element() { return 1; }, $el: routedElement });',
      ],
    ]) {
      const template = routedWith({
        attributes: ['aria-*'],
        handle: 'routed',
      }) as Extract<Template, { type: 'component' }>;
      template.extensions = { vue: { script } };
      const result = processWithVue(template);
      expect(result.files[0].content).toContain(expected);
      expect(result.warnings).toContainEqual({
        message: expect.stringContaining(
          "defineExpose exposes its own 'element'"
        ),
        nodePath: 'extensions.vue.script',
      });
    }
    // No warning when the author exposes no element.
    const plain = routedWith({
      attributes: ['aria-*'],
      handle: 'routed',
    }) as Extract<Template, { type: 'component' }>;
    plain.extensions = { vue: { script: 'defineExpose({ focus: () => 1 });' } };
    expect(processWithVue(plain).warnings).toEqual([]);
  });

  it('types element after a tag override, SVG included, and as HTMLElement for a component', () => {
    for (const [tag, expected] of [
      ['textarea', "shallowRef<HTMLElementTagNameMap['textarea'] | null>"],
      ['FancyInput', 'shallowRef<HTMLElement | null>'],
      ['fancy-input', 'shallowRef<HTMLElement | null>'],
      ['path', "shallowRef<SVGElementTagNameMap['path'] | null>"],
      ['textPath', "shallowRef<SVGElementTagNameMap['textPath'] | null>"],
    ]) {
      const template = routedWith({
        attributes: ['aria-*'],
        handle: 'routed',
      }) as Extract<Template, { type: 'component' }>;
      const input = (
        template.children[0] as unknown as {
          children: Array<Record<string, unknown>>;
        }
      ).children[0];
      input.extensions = { vue: { tag } };
      expect(fileContent(template)).toContain(expected);
    }
  });

  it('leaves the joined camel-case spelling out of the routed spread', () => {
    const content = fileContent(
      routedWith(
        { attributes: ['aria-*'] },
        { 'aria-describedby': { $expression: 'hint' } }
      )
    );
    expect(content).toContain(
      `v-bind="consumerAttributes($attrs, 'routed', ['ariaDescribedby'])"`
    );
    expect(content).toContain(`v-bind="consumerAttributes($attrs, 'root')"`);
  });

  it("joins a routed id list with the consumer's, static or bound", () => {
    const content = fileContent(
      routedWith(
        { attributes: ['aria-*'] },
        {
          'aria-describedby': { $expression: 'hint' },
          'aria-controls': 'field-list',
        }
      )
    );
    // The consumer's camel-case spelling in `$attrs` joins as well.
    expect(content).toContain(
      `:aria-describedby="authoredAndConsumer(hint, $attrs, 'aria-describedby', 'ariaDescribedby')"`
    );
    expect(content).toContain(
      `:aria-controls="authoredAndConsumer('field-list', $attrs, 'aria-controls', 'ariaControls')"`
    );
    expect(content).toContain(
      `:aria-label="authoredOrConsumer(label, $attrs, 'aria-label')"`
    );
    expect(content).toContain('function authoredAndConsumer(');
  });

  it("joins a condition-gated routed id list with the consumer's", () => {
    expect(fileContent(routedConditional())).toContain(
      `:aria-describedby="authoredAndConsumer(hint ? 'field-hint' : undefined, $attrs, 'aria-describedby', 'ariaDescribedby')"`
    );
  });

  it("joins a passthrough root's id lists with the consumer's", () => {
    const content = fileContent({
      type: 'component',
      name: 'HintButton',
      props: { hintId: { type: 'string' }, expanded: { type: 'boolean' } },
      children: [
        {
          type: 'element',
          tag: 'button',
          passthrough: true,
          attributes: {
            'aria-describedby': { $expression: 'hintId' },
            'aria-controls': 'menu',
            title: 'Hint',
          },
          conditionalAttributes: [
            { condition: 'expanded', attributes: { 'aria-details': 'more' } },
          ],
        },
      ],
    });
    expect(content).toContain(
      `:aria-describedby="authoredAndConsumer(hintId, $attrs, 'aria-describedby', 'ariaDescribedby')"`
    );
    expect(content).toContain(
      `:aria-controls="authoredAndConsumer('menu', $attrs, 'aria-controls', 'ariaControls')"`
    );
    expect(content).toContain(
      `:aria-details="authoredAndConsumer(expanded ? 'more' : undefined, $attrs, 'aria-details', 'ariaDetails')"`
    );
    // The joined camel-case spellings stay out of the root's spread.
    expect(content).toContain(
      `v-bind="consumerAttributes($attrs, 'root', ['ariaDescribedby', 'ariaControls', 'ariaDetails'])"`
    );
    expect(content).toContain('function consumerAttributes<');
    expect(content).toContain('const routed = false;');
    // Only an id list joins; another attribute wins.
    expect(content).toContain('title="Hint"');
  });

  it('keeps the camel-case spelling in the spread where a boolean list renders as written', () => {
    const root = fileContent({
      type: 'component',
      name: 'Panel',
      children: [
        {
          type: 'element',
          tag: 'div',
          passthrough: true,
          attributes: { 'aria-describedby': false },
        },
      ],
    });
    expect(root).toContain('v-bind="$attrs"');
    expect(root).not.toContain('consumerAttributes');
    expect(root).not.toContain('authoredAndConsumer');
    const routed = fileContent(
      routedWith({ attributes: ['aria-*'] }, { 'aria-describedby': false })
    );
    expect(routed).toContain(`v-bind="consumerAttributes($attrs, 'routed')"`);
    expect(routed).not.toContain('authoredAndConsumer');
  });

  it('matches a camel-case key against a named hyphenated list', () => {
    const content = fileContent(
      routedWith({ attributes: ['aria-describedby', 'name'] })
    );
    expect(content).toContain(
      "['aria-describedby'].includes(name.replace(/[A-Z]/g, (letter) => '-' + letter).toLowerCase())"
    );
  });

  it("joins a routing root's id list only when its own share holds it", () => {
    const content = fileContent({
      type: 'component',
      name: 'Field',
      children: [
        {
          type: 'element',
          tag: 'div',
          passthrough: true,
          attributes: { 'aria-describedby': 'outside', 'aria-owns': 'popup' },
          children: [
            {
              type: 'element',
              tag: 'input',
              passthrough: { attributes: ['aria-describedby'] },
            },
          ],
        },
      ],
    });
    // aria-describedby is routed away, so the root's stands; aria-owns stays
    // in the root's share and joins it, its camel-case spelling left out.
    expect(content).toContain('aria-describedby="outside"');
    expect(content).toContain(
      `:aria-owns="authoredAndConsumer('popup', $attrs, 'aria-owns', 'ariaOwns')"`
    );
    expect(content).toContain(
      `v-bind="consumerAttributes($attrs, 'root', ['ariaOwns'])"`
    );
    expect(content).toContain(`v-bind="consumerAttributes($attrs, 'routed')"`);
  });

  it('calls a key-guarded handler optionally, so an unset one does nothing', () => {
    const content = fileContent({
      type: 'component',
      name: 'Field',
      props: { onConfirm: { type: '(event: KeyboardEvent) => void' } },
      children: [
        {
          type: 'element',
          tag: 'input',
          events: [
            { name: 'keydown', handler: 'onConfirm', modifiers: ['enter'] },
            { name: 'click', handler: 'onConfirm', modifiers: ['prevent'] },
            {
              name: 'keyup',
              handler: '(event) => onConfirm?.(event)',
              modifiers: ['escape'],
            },
          ],
        },
      ],
    });
    expect(content).toContain(
      '@keydown.enter="(...args) => invokeHandler(onConfirm, ...args)"'
    );
    expect(content).toContain('function invokeHandler<Arguments');
    // Vue's withModifiers guards an unset handler itself.
    expect(content).toContain('@click.prevent="onConfirm"');
    expect(content).toContain('@keyup.escape="(event) => onConfirm?.(event)"');
  });

  it('emits the stylesheet without a style block under stylesheetLink none', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'div',
        attributes: { class: ['card'], style: { color: 'red' } },
        children: [{ type: 'text', content: 'Hi' }],
      },
    ];
    const result = processWithVue(template, {
      styling: { placement: 'separate-file', stylesheetLink: 'none' },
    });
    expect(result.files.map((file) => file.path)).toEqual([
      'Component.vue',
      'Component.css',
    ]);
    expect(result.files[0].content).not.toContain('<style');
    expect(result.files[1].content).toContain('.card {');
  });

  it('names the output file after the component', () => {
    const result = processWithVue({
      type: 'component',
      name: 'Button',
      children: [
        {
          type: 'element',
          tag: 'button',
          children: [{ type: 'text', content: 'Save' }],
        },
      ],
    });
    expect(result.files.map((file) => file.path)).toEqual(['Button.vue']);
  });

  it('emits a typed script setup destructuring the props, defaults inline', () => {
    const content = fileContent({
      type: 'component',
      name: 'Button',
      props: {
        label: { type: 'string', required: true },
        variant: { type: "'primary' | 'secondary'", default: 'primary' },
      },
      children: [
        {
          type: 'element',
          tag: 'button',
          children: [{ type: 'text', expression: 'label' }],
        },
      ],
    });
    expect(content).toContain('<script setup lang="ts">');
    expect(content).toContain('interface ButtonProps {');
    expect(content).toContain(
      "const { label, variant = 'primary' } = defineProps<ButtonProps>();"
    );
  });

  it('renders conditionals as v-if directives on a lone element', () => {
    const content = fileContent([
      {
        type: 'conditional',
        conditions: [
          {
            statement: 'if',
            condition: 'isVisible',
            children: [
              {
                type: 'element',
                tag: 'p',
                children: [{ type: 'text', content: 'Hi' }],
              },
            ],
          },
          {
            statement: 'else',
            children: [
              {
                type: 'element',
                tag: 'p',
                children: [{ type: 'text', content: 'Bye' }],
              },
            ],
          },
        ],
      },
    ]);
    expect(content).toContain('<p v-if="isVisible">Hi</p>');
    expect(content).toContain('<p v-else>Bye</p>');
  });

  it('wraps a multi-child conditional branch in a template element', () => {
    const content = fileContent([
      {
        type: 'conditional',
        conditions: [
          {
            statement: 'if',
            condition: 'show',
            children: [
              {
                type: 'element',
                tag: 'h2',
                children: [{ type: 'text', content: 'A' }],
              },
              {
                type: 'element',
                tag: 'p',
                children: [{ type: 'text', content: 'B' }],
              },
            ],
          },
        ],
      },
    ]);
    expect(content).toContain('<template v-if="show">');
  });

  it('renders iterations as v-for with a key and warns when the key is missing', () => {
    const keyed = fileContent([
      {
        type: 'element',
        tag: 'ul',
        children: [
          {
            type: 'iteration',
            items: 'props.users',
            item: 'user',
            index: 'i',
            key: 'user.id',
            children: [
              {
                type: 'element',
                tag: 'li',
                children: [{ type: 'text', expression: 'user.name' }],
              },
            ],
          },
        ],
      },
    ]);
    expect(keyed).toContain('v-for="(user, i) in props.users"');
    expect(keyed).toContain(':key="user.id"');

    const result = processWithVue([
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
    ]);
    expect(result.files[0].content).not.toContain(':key=');
    expect(result.warnings).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("no 'key' expression"),
      }),
    ]);
  });

  it('renders named and default slots with fallback content', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'div',
        children: [
          {
            type: 'slot',
            name: 'header',
            fallback: [
              {
                type: 'element',
                tag: 'h2',
                children: [{ type: 'text', content: 'Title' }],
              },
            ],
          },
          { type: 'slot', fallback: [{ type: 'text', content: 'Body' }] },
        ],
      },
    ]);
    expect(content).toContain('<slot name="header"><h2>Title</h2></slot>');
    expect(content).toContain('<slot>Body</slot>');
  });

  it('binds expression attributes and renders static classes with conditional :class', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'button',
        attributes: {
          class: ['btn'],
          type: 'button',
          'data-id': { $expression: 'id' },
        },
        conditionalAttributes: [
          { condition: "size === 'large'", attributes: { class: ['btn--lg'] } },
        ],
        children: [{ type: 'text', content: 'Save' }],
      },
    ]);
    expect(content).toContain('class="btn"');
    expect(content).toContain(`:class="{ 'btn--lg': size === 'large' }"`);
    expect(content).toContain(':data-id="id"');
  });

  it('keeps {{ }} in static text literal instead of interpolating', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'p',
        children: [
          { type: 'text', content: 'Use {{ count }} as a placeholder' },
        ],
      },
    ]);
    expect(content).toContain('Use &#123;&#123; count }} as a placeholder');
  });

  it('renders plain style properties as a style attribute under inline styling', () => {
    const content = fileContent(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            style: { backgroundColor: 'blue', 'font-size': '16px' },
          },
          children: [{ type: 'text', content: 'Styled' }],
        },
      ],
      { styling: { placement: 'inline' } }
    );
    expect(content).toContain(
      'style="background-color: blue; font-size: 16px"'
    );
    expect(content).not.toContain('<style>');
  });

  it('keeps nested-selector styles in the style block under inline styling', () => {
    const content = fileContent(
      [
        {
          type: 'element',
          tag: 'span',
          attributes: {
            style: { color: 'gray', ':hover': { color: 'black' } },
          },
          children: [{ type: 'text', content: 'Hover' }],
        },
      ],
      { styling: { placement: 'inline' } }
    );
    expect(content).toContain('data-jte-node="Component-0"');
    expect(content).toContain('[data-jte-node="Component-0"]:hover');
  });

  it('renders the style block as scoped under the in-file placement', () => {
    const content = fileContent({
      type: 'component',
      name: 'Box',
      style: '.box {\n  color: red;\n}',
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { class: ['box'] },
          children: [{ type: 'text', content: 'Hi' }],
        },
      ],
      extensions: { vue: { scoped: true } },
    });
    expect(content).toContain('<style scoped>');
  });

  it('ignores scoped with a warning when styling is not in-file', () => {
    const result = processWithVue(
      {
        type: 'component',
        name: 'Box',
        style: '.box {\n  color: red;\n}',
        children: [
          {
            type: 'element',
            tag: 'div',
            attributes: { class: ['box'] },
            children: [{ type: 'text', content: 'Hi' }],
          },
        ],
        extensions: { vue: { scoped: true } },
      },
      { styling: { placement: 'separate-file' } }
    );
    expect(result.files.map((file) => file.path)).toEqual([
      'Box.vue',
      'Box.css',
    ]);
    expect(result.files[0].content).not.toContain('scoped');
    expect(result.warnings).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("'scoped' option applies only"),
      }),
    ]);
  });

  it('lets node-level vue overrides win, carrying raw directives like v-model', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'input',
        attributes: { type: 'text' },
        events: [{ name: 'input', handler: 'genericHandler' }],
        extensions: {
          vue: {
            attributes: { 'v-model': 'value' },
            events: [{ name: 'input', handler: 'vueHandler' }],
          },
        },
      },
    ]);
    expect(content).toContain('v-model="value"');
    expect(content).toContain('@input="vueHandler"');
    expect(content).not.toContain('genericHandler');
  });

  it('removes every class, the BEM runtime call included, for a null class override', () => {
    const content = process(
      {
          type: 'component',
          name: 'Badge',
          children: [
            {
              type: 'element',
              tag: 'span',
              attributes: { class: ['own'] },
              extensions: { vue: { attributes: { class: null } } },
              children: [{ type: 'text', content: 'New' }],
            },
          ],
        },
      { extensions: [vue(), runtimeBem] }
    ).files[0].content;
    expect(content).toContain('<span>New</span>');
    expect(content).not.toContain('bem(');
  });

  it('removes the condition-gated classes with a null class override, keeping the entries\' other attributes', () => {
    const content = process(
      {
        type: 'component',
        name: 'Badge',
        props: { open: { type: 'boolean' } },
        children: [
          {
            type: 'element',
            tag: 'span',
            attributes: { class: ['own'] },
            conditionalAttributes: [
              {
                condition: 'open',
                attributes: {
                  class: ['Badge--open', 'own--open'],
                  'aria-expanded': { $expression: 'open' },
                },
              },
            ],
            extensions: { vue: { attributes: { class: null } } },
            children: [{ type: 'text', content: 'New' }],
          },
        ],
      },
      { extensions: [vue(), runtimeBem] }
    ).files[0].content;
    expect(content).not.toContain('class');
    expect(content).not.toContain('--open');
    expect(content).not.toContain('bem(');
    expect(content).toContain(':aria-expanded=');
  });

  it('emits no BEM setup once a null class override removes every runtime call', () => {
    const render = (keepOne: boolean) =>
      process(
        {
          type: 'component',
          name: 'Badge',
          children: [
            {
              type: 'element',
              tag: 'span',
              extensions: { vue: { attributes: { class: null } } },
              children: [{ type: 'text', content: 'New' }],
            },
            {
              type: 'element',
              tag: 'span',
              ...(keepOne
                ? {}
                : { extensions: { vue: { attributes: { class: null } } } }),
              children: [{ type: 'text', content: 'Old' }],
            },
          ],
        },
        { extensions: [vue(), runtimeBem] }
      ).files[0].content;
    const removed = render(false);
    expect(removed).not.toContain('createBem');
    expect(removed).not.toContain('const bem');
    const kept = render(true);
    expect(kept).toContain('import { createBem }');
    expect(kept).toContain("const bem = createBem('Badge')");
  });

  it('removes a node attribute the vue override sets to null', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'input',
        attributes: { type: 'checkbox', title: 'All', name: 'all' },
        extensions: { vue: { attributes: { title: null } } },
      },
    ]);
    expect(content).toContain('<input type="checkbox" name="all" />');
  });

  it('lets a node-level vue tag override replace the element and merge its attributes', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'div',
        extensions: { vue: { tag: 'Teleport', attributes: { to: 'body' } } },
        children: [{ type: 'text', content: 'x' }],
      },
    ]);
    expect(content).toContain('<Teleport to="body">');
    expect(content).toContain('</Teleport>');
    expect(content).not.toContain('<div');
  });

  it('applies a component-level vue override (style replace)', () => {
    const content = fileContent({
      type: 'component',
      name: 'Alert',
      style: '.alert {\n  border: 1px solid;\n}',
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { class: ['alert'] },
          children: [{ type: 'text', content: 'Hi' }],
        },
      ],
      extensions: {
        vue: {
          style: '.alert {\n  border: 2px dashed;\n}',
          styleStrategy: 'replace',
        },
      },
    });
    expect(content).toContain('border: 2px dashed;');
    expect(content).not.toContain('border: 1px solid;');
  });

  describe('slot-presence conditions', () => {
    it('resolves slot references to $slots across branches and inside a compound condition, leaving non-slot identifiers bare', () => {
      const content = fileContent({
        type: 'component',
        name: 'Field',
        props: { pressed: { type: 'boolean', required: false } },
        children: [
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'icon',
                children: [{ type: 'slot', name: 'icon' }],
              },
              {
                statement: 'else-if',
                condition: 'prefix',
                children: [{ type: 'slot', name: 'prefix' }],
              },
            ],
          },
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'pressed',
                children: [{ type: 'text', content: 'on' }],
              },
            ],
          },
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'icon && pressed',
                children: [{ type: 'text', content: 'both' }],
              },
            ],
          },
        ],
      });
      expect(content).toContain('v-if="$slots.icon"');
      expect(content).toContain('v-else-if="$slots.prefix"');
      expect(content).toContain('v-if="pressed"');
      expect(content).toContain('v-if="$slots.icon && pressed"');
    });
  });

  it("merges a discriminated branch's $attrs with its own spread into one v-bind", () => {
    const content = fileContent({
      type: 'component',
      name: 'Field',
      children: [
        {
          type: 'conditional',
          conditions: [
            {
              statement: 'if',
              condition: 'visual',
              props: { visual: { type: 'true', required: true } },
              children: [
                {
                  type: 'element',
                  tag: 'div',
                  passthrough: true,
                  attributes: { $spread: { $expression: 'stateProps' } },
                },
              ],
            },
            {
              statement: 'else',
              props: { visual: { type: 'false' } },
              children: [{ type: 'element', tag: 'input', passthrough: true }],
            },
          ],
        },
      ],
    });
    expect(content).toContain(
      '<div v-if="visual" v-bind="mergeProps($attrs, stateProps)" />'
    );
    expect(content).toContain('<input v-else v-bind="$attrs" />');
  });

  it("binds a passthrough root's $attrs before its own attributes and listeners, which compose through a helper", () => {
    const content = fileContent({
      type: 'component',
      name: 'NavigationList',
      props: { label: { type: 'string', required: true } },
      children: [
        {
          type: 'element',
          tag: 'nav',
          passthrough: true,
          attributes: {
            'aria-label': { $expression: 'label' },
            role: 'navigation',
          },
          events: [{ name: 'keydown', handler: 'onKeydown' }],
        },
      ],
    });
    expect(content).toContain('defineOptions({ inheritAttrs: false });');
    expect(content).toContain(
      [
        '  <nav',
        '    v-bind="$attrs"',
        '    :aria-label="authoredOrConsumer(label, $attrs, \'aria-label\')"',
        '    role="navigation"',
        '    @keydown="(...args) => unlessDefaultPrevented(onKeydown, ...args)"',
        '  />',
      ].join('\n')
    );
    expect(content).toContain(
      'function unlessDefaultPrevented<Arguments extends unknown[]>('
    );
  });

  it("applies a composing binding's statement modifiers after the defaultPrevented check", () => {
    const content = fileContent({
      type: 'component',
      name: 'Trigger',
      props: { onPress: { type: '(event: Event) => void' } },
      children: [
        {
          type: 'element',
          tag: 'button',
          passthrough: true,
          events: [
            {
              name: 'click',
              handler: 'onPress',
              modifiers: ['prevent', 'stop'],
            },
            {
              name: 'keydown',
              handler: 'onPress',
              modifiers: ['enter', 'self'],
            },
            { name: 'click', handler: '() => track()' },
          ],
        },
      ],
    });
    expect(content).toContain(
      '@click="(...args) => unlessDefaultPrevented((event) => { ((event) => { event.preventDefault(); event.stopPropagation(); invokeHandler(onPress, event); })(event); (() => track())(); }, ...args)"'
    );
    expect(content).toContain(
      '@keydown.enter="(...args) => unlessDefaultPrevented((event) => { if (event.target !== event.currentTarget) return; invokeHandler(onPress, event); }, ...args)"'
    );
  });

  it('moves a composing once into generated code, claimed per element', () => {
    const content = fileContent({
      type: 'component',
      name: 'Trigger',
      props: { onPress: { type: '(event: Event) => void' } },
      children: [
        {
          type: 'element',
          tag: 'button',
          passthrough: true,
          events: [
            { name: 'click', handler: 'onPress', modifiers: ['once'] },
            {
              name: 'keydown',
              handler: 'onPress',
              modifiers: ['once', 'enter'],
            },
          ],
        },
      ],
    });
    expect(content).toContain(
      '@click="(...args) => unlessDefaultPrevented((event) => { if (!claimOnceListener(event, 0)) return; invokeHandler(onPress, event); }, ...args)"'
    );
    expect(content).toContain(
      '@keydown.enter="(...args) => unlessDefaultPrevented((event) => { if (!claimOnceListener(event, 1)) return; invokeHandler(onPress, event); }, ...args)"'
    );
    expect(content).toContain(
      'const usedOnceListeners = new WeakMap<object, Set<number>>();'
    );
    expect(content).toContain(
      'function claimOnceListener(event: unknown, key: number): boolean {'
    );
  });

  it("composes a captured listener against the consumer's Capture key", () => {
    const content = fileContent({
      type: 'component',
      name: 'Trigger',
      props: {
        onClick: { type: '(event: MouseEvent) => void' },
        onTrack: { type: '(event: Event) => void' },
      },
      children: [
        {
          type: 'element',
          tag: 'button',
          passthrough: true,
          events: [
            { name: 'click', handler: 'onClick' },
            { name: 'click', handler: 'onTrack', modifiers: ['capture'] },
          ],
        },
      ],
    });
    expect(content).toContain('@click="onClick"');
    expect(content).toContain(
      '@click.capture="(...args) => unlessDefaultPrevented(onTrack, ...args)"'
    );
    expect(content).not.toContain('usedOnceListeners');
  });

  it("binds an event of a declared prop's own name bare, which never composes", () => {
    const content = fileContent({
      type: 'component',
      name: 'Trigger',
      props: { onClick: { type: '(event: MouseEvent) => void' } },
      children: [
        {
          type: 'element',
          tag: 'button',
          passthrough: true,
          events: [{ name: 'click', handler: 'onClick' }],
        },
      ],
    });
    expect(content).toContain('@click="onClick"');
    expect(content).not.toContain('unlessDefaultPrevented');
  });

  it('writes a default-value property as the attribute it reflects', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'input',
        attributes: {
          type: 'checkbox',
          defaultChecked: { $expression: 'on' },
          defaultValue: 'yes',
        },
        conditionalAttributes: [
          { condition: 'locked', attributes: { defaultChecked: true } },
        ],
      },
      {
        type: 'element',
        tag: 'select',
        children: [
          {
            type: 'element',
            tag: 'option',
            attributes: { defaultSelected: true },
            children: [{ type: 'text', content: 'A' }],
          },
        ],
      },
    ]);
    expect(content).toContain(':checked.attr="on || undefined"');
    expect(content).toContain('value="yes"');
    expect(content).toContain(
      ':checked.attr="(locked ? true : undefined) || undefined"'
    );
    expect(content).toContain('<option selected>A</option>');
    expect(content).not.toContain('defaultChecked');
    expect(content).not.toContain('defaultSelected');
  });
});

describe('vue() class lists', () => {
  it('joins the conditions of a class repeated across conditional entries', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'button',
        attributes: { class: ['btn'] },
        conditionalAttributes: [
          {
            condition: "v === 'a'",
            attributes: { class: ['shared', 'a', 'btn'] },
          },
          { condition: "v === 'b'", attributes: { class: ['shared', 'b'] } },
        ],
      },
    ]);
    expect(content).toContain(
      `:class="{ 'shared': (v === 'a') || (v === 'b'), 'a': v === 'a', 'b': v === 'b' }"`
    );
  });

  it('parenthesizes a condition with a top-level comma as an object value', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'span',
        conditionalAttributes: [
          { condition: 'a, b', attributes: { class: ['ok'] } },
        ],
      },
    ]);
    expect(content).toContain(`:class="{ 'ok': (a, b) }"`);
  });

  it('writes class names with & and quotes verbatim', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'span',
        attributes: { class: ["[&_svg:not([class*='size-'])]:size-4"] },
        conditionalAttributes: [
          {
            condition: 'on',
            attributes: { class: ["[&>svg]:hidden before:content-['-']"] },
          },
        ],
      },
    ]);
    expect(content).toContain(`class="[&_svg:not([class*='size-'])]:size-4"`);
    expect(content).toContain(
      ':class="{ [`[&>svg]:hidden before:content-[\'-\']`]: on }"'
    );
  });
});

describe('slot-scope bindings named like a named slot', () => {
  // The slot `row` beside an outer loop, a nested loop whose item is `row`,
  // and a loop inside a scoped named-slot projection whose item is `row`.
  const nestedTemplate: Template = {
    type: 'component',
    name: 'Nested',
    props: { groups: { type: 'any[]' } },
    children: [
      {
        type: 'element',
        tag: 'div',
        attributes: { 'data-has-row': { $expression: 'row !== undefined' } },
        children: [{ type: 'slot', name: 'row' }],
      },
      {
        type: 'iteration',
        items: 'groups',
        item: 'group',
        key: 'group.id',
        children: [
          {
            type: 'iteration',
            items: 'group.rows',
            item: 'row',
            key: 'row.id',
            children: [
              {
                type: 'element',
                tag: 'span',
                attributes: { title: { $expression: 'row.label' } },
              },
            ],
          },
          {
            type: 'element',
            tag: 'em',
            attributes: { 'data-outer': { $expression: 'row !== undefined' } },
          },
        ],
      },
      {
        type: 'element',
        tag: 'Table',
        slots: {
          cell: {
            slotScope: ['cell'],
            content: [
              {
                type: 'iteration',
                items: 'cell.items',
                item: 'row',
                key: 'row.id',
                children: [
                  {
                    type: 'element',
                    tag: 'td',
                    attributes: { title: { $expression: 'row.label' } },
                  },
                ],
              },
            ],
          },
        },
      },
    ],
  };
  it('read the binding inside the scoped content and the slot outside it', () => {
    const template: Template = {
      type: 'component',
      name: 'Grid',
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { 'data-custom': { $expression: 'row !== undefined' } },
          children: [{ type: 'slot', name: 'row' }],
        },
        {
          type: 'element',
          tag: 'Table',
          slotScope: ['row'],
          slots: {
            cell: {
              slotScope: ['row'],
              content: [
                {
                  type: 'element',
                  tag: 'td',
                  attributes: { title: { $expression: 'row.label' } },
                },
              ],
            },
          },
          children: [
            {
              type: 'element',
              tag: 'span',
              attributes: { title: { $expression: 'row.label' } },
            },
          ],
        },
      ],
    };
    const content = fileContent(template);
    expect(content).toContain(':data-custom="$slots.row !== undefined"');
    expect(content).toContain(
      [
        '    <template #cell="{ row }">',
        '      <td :title="row.label" />',
      ].join('\n')
    );
    expect(content).toContain(
      [
        '    <template #default="{ row }">',
        '      <span :title="row.label" />',
      ].join('\n')
    );
    // Without named fills the scope binds on the tag itself.
    const tagScoped = fileContent({
      ...(template as Extract<Template, { type: 'component' }>),
      children: [
        {
          type: 'element',
          tag: 'Table',
          slotScope: ['row'],
          children: [
            { type: 'slot', name: 'row' },
            {
              type: 'element',
              tag: 'span',
              attributes: { title: { $expression: 'row.label' } },
            },
          ],
        },
      ],
    });
    expect(tagScoped).toContain(
      [
        '  <Table v-slot="{ row }">',
        '    <slot name="row" />',
        '    <span :title="row.label" />',
      ].join('\n')
    );
  });
  it('scope nested loops and a loop inside a scoped named-slot projection', () => {
    const content = fileContent(nestedTemplate);
    expect(content).toContain(
      '<span v-for="row in group.rows" :key="row.id" :title="row.label" />'
    );
    expect(content).toContain('<em :data-outer="$slots.row !== undefined" />');
    expect(content).toContain(
      '<td v-for="row in cell.items" :key="row.id" :title="row.label" />'
    );
  });
});

describe("vue() a select's defaultValue", () => {
  const option = (value: string) => ({
    type: 'element' as const,
    tag: 'option',
    attributes: { value },
  });

  it('marks the option it matches as selected', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'select',
        attributes: { defaultValue: 'b' },
        children: [option('a'), option('b')],
      },
      {
        type: 'element',
        tag: 'select',
        attributes: { defaultValue: { $expression: 'tier' } },
        children: [option('free')],
      },
      {
        type: 'element',
        tag: 'select',
        attributes: { value: { $expression: 'chosen' }, defaultValue: 'a' },
        children: [option('a')],
      },
    ]);
    expect(content).toContain('<option value="b" selected');
    expect(content).toContain(
      `:selected.attr="('free' === tier) || undefined"`
    );
    expect(content).toContain("(chosen) ?? 'a'");
    expect(content).not.toContain('defaultValue');
  });
});

describe("vue() a textarea's defaultValue", () => {
  it('writes the default value as the text the textarea starts with', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'textarea',
        attributes: { class: ['note'], defaultValue: { $expression: 'note' } },
      },
      {
        type: 'element',
        tag: 'textarea',
        attributes: { defaultValue: '\nDraft' },
      },
      {
        type: 'element',
        tag: 'textarea',
        attributes: { value: { $expression: 'draft' }, defaultValue: 'x' },
      },
    ]);
    expect(content).toContain('<textarea class="note">{{ note }}</textarea>');
    expect(content).toContain('<textarea>\n\nDraft</textarea>');
    expect(content).toContain(
      '<textarea v-bind="definedProperties({ value: draft })">x</textarea>'
    );
    expect(content).not.toContain('defaultValue');
  });

  it('keeps authored children over the default value', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'textarea',
        attributes: { defaultValue: 'unused' },
        children: [{ type: 'text', content: 'own' }],
      },
    ]);
    expect(content).toContain('<textarea>own</textarea>');
    expect(content).not.toContain('unused');
  });
});

describe('vue() component and node overrides', () => {
  const disclosure = (vueOverride: unknown): Template =>
    ({
      type: 'component',
      name: 'Disclosure',
      props: { open: { type: 'boolean' } },
      extensions: { vue: vueOverride },
      children: [{ type: 'element', tag: 'div' }],
    }) as unknown as Template;

  it('rejects a null or false props override entry with its path, not a TypeError', () => {
    for (const entry of [null, false]) {
      expect(() =>
        processWithVue(disclosure({ props: { open: entry } }))
      ).toThrow(
        expect.objectContaining({
          name: 'TemplateError',
          nodePath: 'extensions.vue.props.open',
        })
      );
    }
  });

  it('warns about an override key the vue extension does not read', () => {
    const result = processWithVue(
      disclosure({ omitProps: ['open'], scoped: true })
    );
    expect(result.warnings).toEqual([
      {
        message:
          "The vue override has no 'omitProps' key, so it has no effect; on a component the vue extension reads script, scriptStrategy, imports, importsStrategy, style, styleStrategy, props, propsStrategy, scoped, model",
        nodePath: 'extensions.vue.omitProps',
      },
    ]);
  });

  it("warns about an element override key, and not about another target's", () => {
    const result = processWithVue([
      {
        type: 'element',
        tag: 'input',
        extensions: {
          vue: { attributes: { 'v-model': 'value' }, model: 'value' },
          svelte: { ignore: ['a11y_autofocus'], model: 'value' },
        },
      },
    ] as unknown as Template);
    expect(result.warnings).toEqual([
      {
        message:
          "The vue override has no 'model' key, so it has no effect; on an element the vue extension reads tag, attributes, events",
        nodePath: '[0].extensions.vue.model',
      },
    ]);
  });
});

describe('vue() two-way props', () => {
  const toggle = (extra: Record<string, unknown> = {}): Template =>
    ({
      type: 'component',
      name: 'Toggle',
      props: {
        pressed: {
          type: 'boolean',
          bindable: {
            current: 'isPressed',
            setter: 'setPressed',
            changeProp: 'onPressedChange',
          },
        },
        onPressedChange: { type: '(pressed: boolean) => void' },
      },
      children: [
        {
          type: 'element',
          tag: 'button',
          attributes: { 'aria-pressed': { $expression: 'isPressed' } },
        },
      ],
      ...extra,
    }) as Template;

  it('declares an explicit prop and a typed update emit, not defineModel', () => {
    const content = fileContent(toggle());
    expect(content).toContain("import { computed, shallowRef } from 'vue';");
    expect(content).toContain(
      'const { pressed = undefined, onPressedChange } = defineProps<ToggleProps>();'
    );
    expect(content).toContain(
      "const emit = defineEmits<{ 'update:pressed': [pressed: boolean] }>();"
    );
    expect(content).toContain(
      'const ownPressed = shallowRef<boolean | undefined>(undefined);'
    );
    expect(content).toContain(
      'const isPressed = computed(() => (pressed !== undefined ? pressed : ownPressed.value));'
    );
    expect(content).toContain(
      "  onPressedChange?.(value);\n  emit('update:pressed', value);\n}"
    );
    expect(content).not.toContain('defineModel');
  });

  it("imports only what an author's imports leave out", () => {
    const content = fileContent(
      toggle({ imports: ["import { computed, watch } from 'vue';"] })
    );
    expect(content).toContain("import { shallowRef } from 'vue';");
    expect(content.match(/import \{[^}]*\bcomputed\b/g)).toHaveLength(1);
  });

  it('answers to a bare v-model through modelValue for the prop extensions.vue.model names', () => {
    const content = fileContent(
      toggle({ extensions: { vue: { model: 'pressed' } } })
    );
    expect(content).toContain(
      '  pressed?: boolean | undefined;\n  /** Binds `pressed` with a bare `v-model`; it stands in for `pressed`. */\n  modelValue?: boolean | undefined;'
    );
    expect(content).toContain("  'update:modelValue': [pressed: boolean];");
    expect(content).toContain(
      'computed(() => (modelValue !== undefined ? modelValue : pressed !== undefined ? pressed : ownPressed.value))'
    );
    expect(content).toContain(
      'if (modelValue === undefined && pressed === undefined) ownPressed.value = value;'
    );
    expect(
      processWithVue(toggle({ extensions: { vue: { model: 'pressed' } } }))
        .warnings
    ).toEqual([]);
  });

  /** The script setup's text after the generated setter, where the authored script sits. */
  const authoredScript = (content: string): string =>
    content.slice(
      content.indexOf('function setPressed'),
      content.indexOf('</script>', content.indexOf('function setPressed'))
    );

  it("reads the value of a shared script's free reads of the two-way value", () => {
    const content = fileContent(
      toggle({
        script: [
          'function flip() {',
          '  setPressed(!isPressed);',
          '  onPressedChange?.(isPressed);',
          '}',
          'const label = () => `${isPressed ? "on" : "off"}`;',
          'const state = () => ({ isPressed, pressedNow: isPressed });',
        ].join('\n'),
      })
    );
    const script = authoredScript(content);
    expect(script).toContain(
      '  setPressed(!isPressed.value);\n  onPressedChange?.(isPressed.value);'
    );
    expect(script).toContain(
      'const label = () => `${isPressed.value ? "on" : "off"}`;'
    );
    expect(script).toContain(
      'const state = () => ({ isPressed: isPressed.value, pressedNow: isPressed.value });'
    );
  });

  it('leaves a shadowing name, a member tail, a key, a field, a label, a regex and a type alone', () => {
    const script = [
      'function choose(isPressed: boolean) { return isPressed; }',
      'const pick = ({ isPressed }: { isPressed: boolean }) => isPressed;',
      'const tail = (menu: { isPressed: boolean }) => menu.isPressed;',
      "const keyed = { isPressed: 'yes' };",
      'class Box { isPressed = 1; }',
      'isPressed: for (const x of list) { break isPressed; }',
      "const pattern = /isPressed/; const quote = /'/;",
      'interface Snapshot {\n  isPressed?: boolean;\n  other: string;\n}',
      'type Pair = { isPressed: boolean; at: number };',
      'const cast = (value: unknown) => value as isPressed;',
      'const names = "isPressed";',
    ].join('\n');
    const content = fileContent(toggle({ script }));
    expect(authoredScript(content)).toContain(script);
  });

  it('reads a .value field and a type query of the two-way value through the computed', () => {
    const content = fileContent(
      toggle({
        script: [
          'const field = () => isPressed.value;',
          'const optional = () => isPressed?.value;',
          'type Pressed = typeof isPressed;',
        ].join('\n'),
      })
    );
    const script = authoredScript(content);
    expect(script).toContain('const field = () => isPressed.value.value;');
    expect(script).toContain('const optional = () => isPressed.value?.value;');
    expect(script).toContain('type Pressed = typeof isPressed.value;');
  });

  it('reads past a postfix decrement before a division, a key named class and a private name', () => {
    const content = fileContent(
      toggle({
        script: [
          'const scaled = (a: number) => a-- / 2 + Number(isPressed) / 3;',
          'const nested = () => ({ class: { isPressed } });',
          'class Box { #isPressed = isPressed; }',
        ].join('\n'),
      })
    );
    const script = authoredScript(content);
    expect(script).toContain(
      'const scaled = (a: number) => a-- / 2 + Number(isPressed.value) / 3;'
    );
    expect(script).toContain(
      'const nested = () => ({ class: { isPressed: isPressed.value } });'
    );
    expect(script).toContain('class Box { #isPressed = isPressed.value; }');
  });

  it('leaves a vue script override as written and never rewrites the setter', () => {
    const content = fileContent(
      toggle({
        script: 'const flip = () => setPressed(!isPressed);',
        extensions: { vue: { script: 'const shown = () => isPressed;' } },
      })
    );
    expect(content).toContain(
      'const flip = () => setPressed(!isPressed.value);'
    );
    expect(content).toContain('const shown = () => isPressed;');
    expect(content).not.toContain('setPressed.value');
  });
});

describe('the rest class warning', () => {
  /** A rest root with its own class, whose vue override reads the consumer's class when `reads`. */
  const restRoot = (reads: boolean): Template => ({
    type: 'component',
    name: 'Stack',
    rest: { tag: 'div' },
    children: [
      {
        type: 'element',
        tag: 'div',
        attributes: { $spread: { $expression: 'rest' }, class: ['stack'] },
        extensions: reads
          ? {
              vue: {
                attributes: { class: ['stack', { $expression: 'rest.class' }] },
              },
            }
          : {},
      },
    ],
  });
  const restWarnings = (template: Template): string[] =>
    processWithVue(template)
      .warnings.filter((warning) => warning.message.includes('spreads rest'))
      .map((warning) => warning.message);

  it("never warns about a rest root's own class, which Vue merges with the consumer's", () => {
    expect(restWarnings(restRoot(false))).toEqual([]);
  });
});

describe('vue() form controls bound to a value', () => {
  function control(
    tag: string,
    attributes: Attributes,
    events: EventDefinition[]
  ): string {
    return fileContent({
      type: 'component',
      name: 'Control',
      props: { value: { type: 'string' }, on: { type: 'boolean' } },
      children: [{ type: 'element', tag, attributes, events }],
    } as Template);
  }

  /** Every name the removed controlled-property restore generated. */
  function expectNoRestore(content: string): void {
    expect(content).not.toContain('restoreControlledProperty');
    expect(content).not.toContain('TrackControlledChecked');
    expect(content).not.toContain('track-controlled-checked');
    expect(content).not.toContain('nextTick');
  }

  it("renders a checkbox's listeners as written, leaving the property to Vue's binding", () => {
    const content = control(
      'input',
      {
        type: 'checkbox',
        checked: { $expression: 'on' },
        indeterminate: { $expression: 'on' },
      },
      [
        { name: 'click', handler: 'track' },
        { name: 'change', handler: 'toggle' },
      ]
    );
    expect(content).toContain('@click="track"');
    expect(content).toContain('@change="toggle"');
    expectNoRestore(content);
  });

  it("renders a text input's and a select's listeners as written", () => {
    const text = control('input', { value: { $expression: 'value' } }, [
      { name: 'input', handler: 'choose' },
    ]);
    expect(text).toContain('@input="choose"');
    expectNoRestore(text);
    const select = control('select', { value: { $expression: 'value' } }, [
      { name: 'change', handler: 'choose' },
    ]);
    expect(select).toContain('@change="choose"');
    expectNoRestore(select);
  });

  it("keeps a radio's bound checked and an author's ref as written", () => {
    const content = control(
      'input',
      {
        type: 'radio',
        name: 'size',
        ref: 'firstRadio',
        checked: { $expression: 'on' },
      },
      [{ name: 'change', handler: 'choose' }]
    );
    expect(content).toContain('ref="firstRadio"');
    expect(content).toContain('definedProperties({ checked: on })');
    expect(content.match(/\bref=/g)).toHaveLength(1);
    expectNoRestore(content);
  });

  it('renders the composed listener alone on a passthrough root', () => {
    const content = fileContent({
      type: 'component',
      name: 'Field',
      props: { value: { type: 'string' } },
      children: [
        {
          type: 'element',
          tag: 'input',
          passthrough: true,
          attributes: { value: { $expression: 'value' } },
          events: [{ name: 'input', handler: 'update' }],
        },
      ],
    });
    expect(content).toContain(
      `@input="(...args) => unlessDefaultPrevented(update, ...args)"`
    );
    expectNoRestore(content);
  });
});

describe('vue() spreads on a surface element', () => {
  // A plain object spread would let a `$spread` carrying `class`, `style` or
  // a listener replace the consumer's; Vue's `mergeProps` joins them.
  it("merges a passthrough root's $attrs with a $spread through mergeProps", () => {
    const content = fileContent({
      type: 'component',
      name: 'Surface',
      props: { extraProps: { type: 'Record<string, unknown>', required: true } },
      children: [
        {
          type: 'element',
          tag: 'div',
          passthrough: true,
          attributes: { $spread: { $expression: 'extraProps' }, class: ['surface'] },
        },
      ],
    });
    expect(content).toContain("import { mergeProps } from 'vue';");
    expect(content).toContain(
      '<div class="surface" v-bind="mergeProps($attrs, extraProps)" />'
    );
  });

  it("merges a routed root's and its routed element's share of $attrs with a $spread", () => {
    const content = fileContent({
      type: 'component',
      name: 'Field',
      props: {
        rootProps: { type: 'Record<string, unknown>', required: true },
        inputProps: { type: 'Record<string, unknown>', required: true },
      },
      children: [
        {
          type: 'element',
          tag: 'label',
          passthrough: true,
          attributes: { $spread: { $expression: 'rootProps' }, class: ['field'] },
          children: [
            {
              type: 'element',
              tag: 'input',
              passthrough: { attributes: ['aria-*'] },
              attributes: { $spread: { $expression: 'inputProps' } },
            },
          ],
        },
      ],
    });
    expect(content).toContain("import { mergeProps } from 'vue';");
    expect(content).toContain(
      `v-bind="mergeProps(consumerAttributes($attrs, 'root'), rootProps)"`
    );
    expect(content).toContain(
      `v-bind="mergeProps(consumerAttributes($attrs, 'routed'), inputProps)"`
    );
    expect(content).not.toContain('...rootProps');
    expect(content).not.toContain('...inputProps');
  });

  it("merges a rest node's rest with a $spread through mergeProps, in spread order", () => {
    const stack = (spreads: string[]): Template => ({
      type: 'component',
      name: 'Stack',
      rest: { tag: 'div' },
      props: { extraProps: { type: 'Record<string, unknown>', required: true } },
      children: [
        {
          type: 'element',
          tag: 'div',
          children: [
            {
              type: 'element',
              tag: 'div',
              attributes: {
                $spread: spreads.map((expression) => ({ $expression: expression })),
                class: ['stack'],
              },
            },
          ],
        },
      ],
    });
    const restFirst = fileContent(stack(['rest', 'extraProps']));
    expect(restFirst).toContain("import { mergeProps, useAttrs } from 'vue';");
    expect(restFirst).toContain(
      '<div class="stack" v-bind="mergeProps(rest, extraProps)" />'
    );
    expect(fileContent(stack(['extraProps', 'rest']))).toContain(
      'v-bind="mergeProps(extraProps, rest)"'
    );
  });

  it('spreads two $spreads of a plain element as one object, the later winning', () => {
    const content = fileContent({
      type: 'component',
      name: 'Pair',
      props: {
        first: { type: 'Record<string, unknown>', required: true },
        second: { type: 'Record<string, unknown>', required: true },
      },
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            $spread: [{ $expression: 'first' }, { $expression: 'second' }],
          },
        },
      ],
    });
    expect(content).not.toContain('mergeProps');
    expect(content).toContain('v-bind="{ ...first, ...second }"');
  });
});

describe('vue derived values', () => {
  const template: Template = {
    type: 'component',
    name: 'Total',
    props: {
      values: { type: 'number[]', required: true },
      limit: {
        type: 'number',
        bindable: { current: 'currentLimit', setter: 'setLimit' },
      },
    },
    derived: {
      shown: 'values.slice(0, currentLimit)',
      summary: '{ shown, total: shown.length }',
    },
    script:
      'function first() {\n  const shown = [0];\n  return [summary.total, shown[0]];\n}',
    extensions: {
      vue: { script: 'const watched = shown.value;', scriptStrategy: 'merge' },
    },
    children: [
      {
        type: 'element',
        tag: 'output',
        children: [{ type: 'text', expression: 'summary.total' }],
      },
    ],
  };

  it('declares each as a computed reading two-way and earlier derived values through .value', () => {
    const content = fileContent(template);
    expect(content).toContain(
      [
        'const shown = computed(() => values.slice(0, currentLimit.value));',
        'const summary = computed(() => ({ shown: shown.value, total: shown.value.length }));',
      ].join('\n')
    );
    // The template reads the values bare, which Vue unwraps.
    expect(content).toContain('<output>{{ summary.total }}</output>');
  });

  it('reads them in the shared script through .value, leaving shadowing locals and overrides alone', () => {
    const content = fileContent(template);
    expect(content).toContain(
      'function first() {\n  const shown = [0];\n  return [summary.value.total, shown[0]];\n}'
    );
    expect(content).toContain('const watched = shown.value;');
    expect(content).not.toContain('shown.value.value');
  });

  it("imports computed without a two-way value, and not beside an author's import of it", () => {
    const plain: Template = {
      type: 'component',
      name: 'Total',
      props: { values: { type: 'number[]', required: true } },
      derived: { total: 'values.length' },
      children: [
        {
          type: 'element',
          tag: 'output',
          children: [{ type: 'text', expression: 'total' }],
        },
      ],
    };
    expect(fileContent(plain)).toContain("import { computed } from 'vue';");
    const authored = fileContent({
      ...plain,
      imports: ["import { computed } from 'vue';"],
    });
    expect(authored.match(/import \{[^}]*computed/g)).toHaveLength(1);
  });
});

describe('vue declared ids', () => {
  const template: Template = {
    type: 'component',
    name: 'Field',
    props: { id: { type: 'string' } },
    ids: { inputId: { prefix: 'field', prop: 'id' }, hintId: 'field-hint' },
    derived: { describedBy: '`${inputId} ${hintId}`' },
    script: 'function focus() {\n  document.getElementById(inputId)?.focus();\n}',
    children: [{ type: 'element', tag: 'input', attributes: { id: { $expression: 'inputId' } } }],
  };

  it('builds each from one useId(), an id with a prop as a computed read through .value', () => {
    const content = fileContent(template);
    expect(content).toContain("import { computed, useId } from 'vue';");
    expect(content).toContain(
      [
        'const generatedId = useId();',
        'const inputId = computed(() => id ?? `field-${generatedId}`);',
        'const hintId = `field-hint-${generatedId}`;',
        '',
        'const describedBy = computed(() => `${inputId.value} ${hintId}`);',
      ].join('\n')
    );
    expect(content).toContain('document.getElementById(inputId.value)?.focus();');
    expect(content).toContain(':id="inputId"');
  });
});

describe('markup the Vue compiler would read differently', () => {
  it('escapes a comment ending sequence so the comment runs to its end', () => {
    const content = fileContent([
      { type: 'comment', content: 'ends with --> and opens <!-- again' },
      { type: 'element', tag: 'div' },
    ]);
    expect(content).toContain('<!-- ends with --&gt; and opens &lt;!-- again -->');
    expect(content).not.toContain('--> and');
  });

  it('writes a second line break ahead of pre and textarea content that begins with one', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'pre',
        children: [{ type: 'text', content: '\n  keep  spaces' }],
      },
      {
        type: 'element',
        tag: 'textarea',
        children: [{ type: 'text', content: '\nDraft' }],
      },
      {
        type: 'element',
        tag: 'pre',
        children: [{ type: 'text', content: 'no break' }],
      },
    ]);
    expect(content).toContain('<pre>\n\n  keep  spaces</pre>');
    expect(content).toContain('<textarea>\n\nDraft</textarea>');
    expect(content).toContain('<pre>no break</pre>');
  });

  it('writes adjacent closing braces of a text interpolation apart', () => {
    const content = fileContent({
      type: 'component',
      name: 'Dump',
      props: { n: { type: 'number' } },
      children: [
        {
          type: 'element',
          tag: 'p',
          children: [
            { type: 'text', expression: 'JSON.stringify({ a: { b: n }})' },
          ],
        },
      ],
    });
    expect(content).toContain('{{ JSON.stringify({ a: { b: n } }) }}');
  });
});

describe('vue() cascade layer order in a style block', () => {
  const layered: Template = {
    type: 'component',
    name: 'Panel',
    children: [
      {
        type: 'element',
        tag: 'section',
        attributes: {
          class: ['panel'],
          style: { color: 'white', '&:hover': { color: 'silver' } },
        },
      },
    ],
  };

  it('loads the generated module from the block, written beside the component file', () => {
    // A module the block loads that emits rules inside one of the layers
    // would otherwise compile ahead of an order stated in the block (#374).
    for (const placement of ['in-file', 'inline'] as const) {
      const result = processWithVue(layered, {
        styling: {
          language: 'scss',
          placement,
          layer: {
            name: 'kit.components',
            order: ['kit.reset', 'kit.base', 'kit.components'],
          },
        },
      });
      expect(result.files.map((file) => file.path)).toEqual([
        'Panel.vue',
        '_layer-order.scss',
      ]);
      expect(result.files[1].content).toBe(
        '@layer kit.reset, kit.base, kit.components;\n'
      );
      expect(result.files[0].content).toContain(
        "<style lang=\"scss\">\n@use './layer-order' as *;\n\n@layer kit.components {"
      );
    }
  });

  it('loads the generated module from a separate stylesheet', () => {
    const result = processWithVue(layered, {
      styling: {
        language: 'scss',
        placement: 'separate-file',
        layer: { name: 'kit.components', order: ['kit.base', 'kit.components'] },
      },
    });
    expect(result.files.map((file) => file.path)).toEqual([
      'Panel.vue',
      'Panel.scss',
      '_layer-order.scss',
    ]);
    expect(result.files[1].content.startsWith("@use './layer-order' as *;\n")).toBe(
      true
    );
  });
});

describe('vue() relayed two-way props', () => {
  const select = (extra: Record<string, unknown> = {}): Template =>
    ({
      type: 'component',
      name: 'Select',
      props: {
        value: {
          type: 'string',
          bindable: { given: 'givenValue', report: 'reportValue', changeProp: 'onValueChange' },
        },
        onValueChange: { type: '(value: string) => void' },
        open: { type: 'boolean', bindable: { given: 'givenOpen', report: 'reportOpen' } },
      },
      script: 'function isControlled() { return givenValue !== undefined; }',
      children: [
        {
          type: 'element',
          tag: 'Driver',
          attributes: {
            value: { $expression: 'givenValue' },
            onValueChange: { $expression: 'reportValue' },
            open: { $expression: 'givenOpen' },
            onOpenChange: { $expression: 'reportOpen' },
          },
        },
      ],
      ...extra,
    }) as Template;

  it('reads the given value as a computed and reports, then emits, with no own copy', () => {
    const content = fileContent(select());
    expect(content).toContain("import { computed } from 'vue';");
    expect(content).not.toContain('shallowRef');
    expect(content).toContain(
      "const emit = defineEmits<{\n  'update:value': [value: string];\n  'update:open': [open: boolean];\n}>();"
    );
    expect(content).toContain(
      [
        'const givenValue = computed(() => value);',
        'function reportValue(next: string) {',
        '  onValueChange?.(next);',
        "  emit('update:value', next);",
        '}',
        '',
        'const givenOpen = computed(() => open);',
        'function reportOpen(next: boolean) {',
        "  emit('update:open', next);",
        '}',
      ].join('\n')
    );
    expect(content).toContain('function isControlled() { return givenValue.value !== undefined; }');
    expect(content).toContain(':value="givenValue"');
  });

  it('reads modelValue first and emits update:modelValue for the prop extensions.vue.model names', () => {
    const content = fileContent(select({ extensions: { vue: { model: 'value' } } }));
    expect(content).toContain('  modelValue?: string | undefined;');
    expect(content).toContain(
      "  'update:value': [value: string];\n  'update:modelValue': [value: string];\n  'update:open': [open: boolean];"
    );
    expect(content).toContain(
      'const givenValue = computed(() => (modelValue !== undefined ? modelValue : value));'
    );
    expect(content).toContain(
      "  onValueChange?.(next);\n  emit('update:value', next);\n  emit('update:modelValue', next);\n}"
    );
  });

  const requiredValueProps = {
    value: {
      type: 'string',
      required: true,
      bindable: { given: 'givenValue', report: 'reportValue', changeProp: 'onValueChange' },
    },
    onValueChange: { type: '(value: string) => void' },
    open: { type: 'boolean', bindable: { given: 'givenOpen', report: 'reportOpen' } },
  };

  it('declares a required prop optional when extensions.vue.model names it, since modelValue stands in', () => {
    const content = fileContent(
      select({ props: requiredValueProps, extensions: { vue: { model: 'value' } } })
    );
    expect(content).toContain('  value?: string | undefined;\n');
    expect(content).toContain('  modelValue?: string | undefined;');
  });

  it('keeps a required two-way prop required when no model names it', () => {
    const content = fileContent(select({ props: requiredValueProps }));
    expect(content).toContain('  value: string;\n');
  });

  it('lists the emits of both forms in prop order', () => {
    const content = fileContent(
      select({
        props: {
          pressed: { type: 'boolean', bindable: { current: 'isPressed', setter: 'setPressed' } },
          value: { type: 'string', bindable: { given: 'givenValue', report: 'reportValue' } },
        },
        script: undefined,
        children: [{ type: 'element', tag: 'button', attributes: { 'aria-pressed': { $expression: 'isPressed' }, value: { $expression: 'givenValue' } } }],
      })
    );
    expect(content).toContain("import { computed, shallowRef } from 'vue';");
    expect(content).toContain(
      "  'update:pressed': [pressed: boolean];\n  'update:value': [value: string];"
    );
    expect(content.indexOf('const ownPressed')).toBeLessThan(content.indexOf('const givenValue'));
  });
});
