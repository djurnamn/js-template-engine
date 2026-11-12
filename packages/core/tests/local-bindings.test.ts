import { describe, expect, it } from 'vitest';

import {
  isBindableName,
  localAlias,
  normalizeSlotName,
  propAliases,
  scriptDeclarations,
  scriptShadowedPropAliases,
} from '../src/local-bindings';
import { topLevelDeclarations } from '../src/expression-scope';

describe('local bindings', () => {
  it('tells a bindable prop name from one that needs an alias', () => {
    expect(isBindableName('label')).toBe(true);
    expect(isBindableName('aria-pressed')).toBe(false);
    expect(isBindableName('for')).toBe(false);
    expect(isBindableName('class')).toBe(false);
  });

  it('camel-cases an alias and suffixes it while it is not free', () => {
    expect(localAlias('aria-pressed', new Set(['aria-pressed']))).toBe(
      'ariaPressed'
    );
    expect(localAlias('for', new Set())).toBe('forProp');
    expect(localAlias('class', new Set())).toBe('classProp');
    expect(localAlias('aria-label', new Set(['ariaLabel']))).toBe(
      'ariaLabelProp'
    );
    expect(localAlias('9-lives', new Set())).toBe('_9Lives');
    expect(localAlias('compose-event-handlers', new Set())).toBe(
      'composeEventHandlersProp'
    );
  });

  it("steers an alias clear of the engine's names and the build's reserved ones", () => {
    expect(localAlias('invoke-handler', new Set())).toBe('invokeHandlerProp');
    expect(localAlias('Tag-2', new Set())).toBe('Tag2Prop');
    expect(localAlias('use-attrs', new Set())).toBe('useAttrs');
    expect(localAlias('use-attrs', new Set(), new Set(['useAttrs']))).toBe(
      'useAttrsProp'
    );
    expect(
      propAliases(['use-attrs'], { reservedNames: new Set(['useAttrs']) })
    ).toEqual(new Map([['use-attrs', 'useAttrsProp']]));
  });

  it('normalizes a slot name to its prop identifier', () => {
    expect(normalizeSlotName('navigation-menu')).toBe('navigationMenu');
    expect(normalizeSlotName('footer_content')).toBe('footerContent');
    expect(normalizeSlotName('header')).toBe('header');
    expect(normalizeSlotName('closeButton')).toBe('closeButton');
    expect(normalizeSlotName('123invalid')).toBe('_123invalid');
  });
});

describe('propAliases', () => {
  it('aliases only the props that need one, clear of props and slot props', () => {
    expect(
      propAliases(['aria-pressed', 'label', 'for', 'class'], {
        children: [
          { type: 'slot', name: 'aria-pressed' },
          { type: 'slot', name: 'class-prop' },
        ],
      })
    ).toEqual(
      new Map([
        ['aria-pressed', 'ariaPressedProp'],
        ['for', 'forProp'],
        ['class', 'classPropProp'],
      ])
    );
  });
});

describe('propAliases and the component script', () => {
  it('keeps an alias clear of every word of the script and its overrides', () => {
    expect(
      propAliases(['aria-pressed', 'for'], {
        script: 'const ariaPressed = computeState();',
        extensions: { vue: { script: 'function forProp() {}' } },
      })
    ).toEqual(
      new Map([
        ['aria-pressed', 'ariaPressedProp'],
        ['for', 'forPropProp'],
      ])
    );
  });
});

describe('scriptDeclarations', () => {
  it('reads declared names, destructuring patterns, functions and reactive declarations', () => {
    expect(
      scriptDeclarations(
        [
          'const [ownOpen, setOwnOpen] = useState(defaultOpen);',
          'let { a, b: renamed } = props;',
          'var count = 0;',
          'function toggle() {',
          '  setOpen(!isOpen);',
          '}',
          'class Store {}',
          '$: isOpen = open ?? defaultOpen;',
          '// const commented = 1;',
        ].join('\n')
      )
    ).toEqual(
      new Set([
        'ownOpen',
        'setOwnOpen',
        'a',
        'renamed',
        'count',
        'toggle',
        'Store',
        'isOpen',
      ])
    );
  });

  it('leaves out names a script only reads or calls', () => {
    expect(
      scriptDeclarations(
        'setPressed((pressed) => !pressed);\nif (isPressed) report();'
      )
    ).toEqual(new Set());
    expect(scriptDeclarations(undefined)).toEqual(new Set());
  });

  it("reads a renamed destructuring key's target, not the key or its default", () => {
    expect(scriptDeclarations('const { isOpen: x = 1 } = {};')).toEqual(
      new Set(['x'])
    );
    expect(
      scriptDeclarations(
        'const { a: [first, { b: second = fallback }], ...others } = props;'
      )
    ).toEqual(new Set(['first', 'second', 'others']));
  });

  it('reads the const of an `as const` assertion as no declaration', () => {
    expect(scriptDeclarations('let x = y as const\nconst z = 1')).toEqual(
      new Set(['x', 'z'])
    );
    expect(scriptDeclarations('let x = y as const;\nconst z = 1;')).toEqual(
      new Set(['x', 'z'])
    );
    expect(
      scriptDeclarations(
        "const sizes = ['sm', 'md'] as const\nlet size = sizes[0]"
      )
    ).toEqual(new Set(['sizes', 'size']));
  });

  it('leaves out a declaration inside a function, block or callback', () => {
    expect(
      scriptDeclarations(
        [
          'function toggle() {',
          '  let isOpen = true;',
          '  const { next } = state;',
          '}',
          'const close = () => { var isOpen = false; };',
          'if (ready) { let pending = 1; }',
        ].join('\n')
      )
    ).toEqual(new Set(['toggle', 'close']));
  });
});

describe('propAliases with two-way props', () => {
  it("keeps an alias clear of a two-way prop's value and setter", () => {
    expect(
      propAliases(['aria-pressed', 'pressed'], {
        props: {
          pressed: {
            type: 'boolean',
            bindable: { current: 'ariaPressed', setter: 'setPressed' },
          },
        },
      })
    ).toEqual(new Map([['aria-pressed', 'ariaPressedProp']]));
  });

  it('reads only the top-level declarations of a script', () => {
    expect(
      topLevelDeclarations(
        [
          'const value = computed(() => { const inner = 1; return inner; });',
          'let { open, label: title = "x", ...others } = state, [first] = list',
          'function describe(label) { const local = label; return local; }',
          'class Store {}',
          'const after = 1',
        ].join('\n')
      )
    ).toEqual(
      new Set([
        'value',
        'open',
        'title',
        'others',
        'first',
        'describe',
        'Store',
        'after',
      ])
    );
  });

  it('reads import bindings, annotated declarators and enums as top-level declarations', () => {
    expect(
      topLevelDeclarations(
        [
          "import fallback, { value, label as caption, type Kind } from './a';",
          "import * as helpers from './b';",
          "import type Shape from './c';",
          "import './d';",
          'const typed: Map<string, number> = new Map(), other = 1;',
          'enum Size { Small }',
          'const enum Tone { Loud }',
        ].join('\n')
      )
    ).toEqual(
      new Set([
        'fallback',
        'value',
        'caption',
        'Kind',
        'helpers',
        'Shape',
        'typed',
        'other',
        'Size',
        'Tone',
      ])
    );
  });

  it('aliases a prop a script declares at its top level, clear of every name', () => {
    expect(
      scriptShadowedPropAliases(
        ['value', 'label', 'aria-pressed'],
        [
          'const value = computed(() => 1);\nfunction describe() { const label = 2; return label; }',
        ],
        new Map([['aria-pressed', 'ariaPressed']])
      )
    ).toEqual(new Map([['value', 'valueProp']]));
    expect(
      scriptShadowedPropAliases(
        ['value'],
        ['const value = 1;\nconst valueProp = 2;'],
        new Map()
      )
    ).toEqual(new Map([['value', 'valuePropProp']]));
    expect(
      scriptShadowedPropAliases(['value'], [undefined], new Map())
    ).toEqual(new Map());
    expect(
      scriptShadowedPropAliases(
        ['value', 'label'],
        [undefined, "import { value } from './store';"],
        new Map()
      )
    ).toEqual(new Map([['value', 'valueProp']]));
    // A semicolon-free `const` after an `as const` line still declares.
    expect(
      scriptShadowedPropAliases(
        ['value', 'label'],
        ["const sizes = ['sm', 'md'] as const\nconst value = sizes[0]"],
        new Map()
      )
    ).toEqual(new Map([['value', 'valueProp']]));
  });
});
