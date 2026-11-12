import { TemplateError } from '@js-template-engine/core';
import type { TemplateNode } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import {
  collectSnippetProps,
  runesPropsDeclaration,
  runesPropsDestructure,
  snippetPropType,
} from '../src/runes-props';

describe('collectSnippetProps', () => {
  it('collects the default and named slots in document order', () => {
    const children: TemplateNode[] = [
      {
        type: 'element',
        tag: 'div',
        children: [
          { type: 'slot', name: 'header' },
          { type: 'slot' },
        ],
      },
    ];
    expect(collectSnippetProps(children, {})).toEqual([
      { slotName: 'header', propName: 'header', localName: 'header', exposes: [] },
      { slotName: undefined, propName: 'children', localName: 'children', exposes: [] },
    ]);
  });

  it('normalizes exposed bindings on a scoped slot', () => {
    const children: TemplateNode[] = [
      {
        type: 'slot',
        exposes: { api: 'api', state: { value: 'machine.state', type: 'string' } },
      },
    ];
    expect(collectSnippetProps(children, {})).toEqual([
      {
        slotName: undefined,
        propName: 'children',
        localName: 'children',
        exposes: [
          { name: 'api', value: 'api', type: undefined },
          { name: 'state', value: 'machine.state', type: 'string' },
        ],
      },
    ]);
  });

  it('deduplicates a slot rendered in several conditional branches', () => {
    const children: TemplateNode[] = [
      {
        type: 'conditional',
        conditions: [
          {
            statement: 'if',
            condition: 'expanded',
            children: [{ type: 'slot', name: 'icon' }],
          },
          { statement: 'else', children: [{ type: 'slot', name: 'icon' }] },
        ],
      },
    ];
    expect(collectSnippetProps(children, {})).toHaveLength(1);
  });

  it('rejects a slot whose prop name collides with a declared prop', () => {
    const children: TemplateNode[] = [{ type: 'slot', name: 'label' }];
    expect(() =>
      collectSnippetProps(children, { label: { type: 'string' } })
    ).toThrowError(TemplateError);
    expect(() =>
      collectSnippetProps(children, { label: { type: 'string' } })
    ).toThrowError(
      "The slot 'label' collides with the declared prop 'label'"
    );
  });

  it('rejects two slots whose names normalize to the same prop name', () => {
    const children: TemplateNode[] = [
      { type: 'slot', name: 'close-button' },
      { type: 'slot', name: 'closeButton' },
    ];
    expect(() => collectSnippetProps(children, {})).toThrowError(
      TemplateError
    );
    expect(() => collectSnippetProps(children, {})).toThrowError(
      "Slots 'close-button' and 'closeButton' both normalize to the Svelte snippet prop 'closeButton'"
    );
  });

  it('descends into slot fallbacks and projected named-slot content', () => {
    const children: TemplateNode[] = [
      {
        type: 'slot',
        name: 'body',
        fallback: [{ type: 'slot', name: 'placeholder' }],
      },
      {
        type: 'element',
        tag: 'Composed',
        slots: { actions: [{ type: 'slot', name: 'actions-content' }] },
      },
    ];
    expect(collectSnippetProps(children, {}).map((prop) => prop.propName)).toEqual([
      'body',
      'placeholder',
      'actionsContent',
    ]);
  });

  it('aliases a snippet prop a same-named projected snippet would shadow', () => {
    // The composer's own `icon` slot - with a fallback - forwarded into a
    // composed child's `icon` slot: the projected `{#snippet icon()}` would
    // shadow the `icon` prop inside its own body, so the prop is aliased.
    const children: TemplateNode[] = [
      {
        type: 'element',
        tag: 'IconLabel',
        slots: {
          icon: [
            {
              type: 'slot',
              name: 'icon',
              fallback: [{ type: 'element', tag: 'span' }],
            },
          ],
        },
      },
    ];
    expect(collectSnippetProps(children, {})).toEqual([
      { slotName: 'icon', propName: 'icon', localName: 'iconSlot', exposes: [] },
    ]);
  });

  it('aliases a default slot shadowed by a slotScope children snippet', () => {
    // A `slotScope` consumer renders its children inside `{#snippet
    // children(...)}` - a binding named `children` that would shadow the
    // component's own default-slot prop rendered inside it.
    const children: TemplateNode[] = [
      {
        type: 'element',
        tag: 'Driver',
        slotScope: ['api'],
        children: [{ type: 'slot', fallback: [{ type: 'element', tag: 'span' }] }],
      },
    ];
    expect(collectSnippetProps(children, {})).toEqual([
      {
        slotName: undefined,
        propName: 'children',
        localName: 'childrenSlot',
        exposes: [],
      },
    ]);
  });

  it('extends the alias past declared props and other slot names', () => {
    const children: TemplateNode[] = [
      {
        type: 'element',
        tag: 'IconLabel',
        slots: {
          icon: [{ type: 'slot', name: 'icon' }],
        },
      },
      { type: 'slot', name: 'iconSlot' },
    ];
    expect(
      collectSnippetProps(children, {}).map((prop) => [
        prop.propName,
        prop.localName,
      ])
    ).toEqual([
      ['icon', 'iconSlotSlot'],
      ['iconSlot', 'iconSlot'],
    ]);
  });

  it('keeps the prop name when the projected snippet name differs', () => {
    const children: TemplateNode[] = [
      {
        type: 'element',
        tag: 'IconLabel',
        slots: {
          icon: [{ type: 'slot', name: 'triggerIcon' }],
        },
      },
    ];
    expect(collectSnippetProps(children, {})).toEqual([
      {
        slotName: 'triggerIcon',
        propName: 'triggerIcon',
        localName: 'triggerIcon',
        exposes: [],
      },
    ]);
  });
});

describe('snippetPropType', () => {
  it('types an ordinary slot as a bare Snippet', () => {
    expect(
      snippetPropType({
        slotName: undefined,
        propName: 'children',
        localName: 'children',
        exposes: [],
      })
    ).toBe('Snippet');
  });

  it('bundles the exposed bindings into one object parameter', () => {
    expect(
      snippetPropType({
        slotName: undefined,
        propName: 'children',
        localName: 'children',
        exposes: [
          { name: 'api', value: 'api' },
          { name: 'state', value: 'state', type: 'string' },
        ],
      })
    ).toBe('Snippet<[{ api: any; state: string }]>');
  });
});

describe('runesPropsDeclaration', () => {
  it('renders declared props as interface members, optional unless required', () => {
    expect(
      runesPropsDeclaration(
        {
          imageUrl: { type: 'string', required: true },
          size: { type: 'number', default: 48 },
          pressed: { type: 'boolean' },
        },
        []
      )
    ).toBe(
      [
        'interface Props {',
        '  imageUrl: string;',
        '  size?: number | undefined;',
        '  pressed?: boolean | undefined;',
        '}',
      ].join('\n')
    );
  });

  it('appends snippet props after the declared props', () => {
    expect(
      runesPropsDeclaration({ label: { type: 'string', required: true } }, [
        { slotName: 'icon', propName: 'icon', localName: 'icon', exposes: [] },
        {
          slotName: undefined,
          propName: 'children',
          localName: 'children',
          exposes: [{ name: 'api', value: 'api' }],
        },
      ])
    ).toBe(
      [
        'interface Props {',
        '  label: string;',
        '  icon?: Snippet | undefined;',
        '  children?: Snippet<[{ api: any }]> | undefined;',
        '}',
      ].join('\n')
    );
  });

  it('returns undefined when there is nothing to declare', () => {
    expect(runesPropsDeclaration({}, [])).toBeUndefined();
  });

  it('types a passthrough root with its attribute and element types', () => {
    expect(
      runesPropsDeclaration({ label: { type: 'string', required: true } }, [], {
        attributes: "SvelteHTMLElements['div']",
        element: "HTMLElementTagNameMap['div']",
      })
    ).toBe(
      [
        "type Props = SvelteHTMLElements['div'] & {",
        '  label: string;',
        '  class?: string | undefined;',
        '  style?: string | undefined;',
        "  element?: HTMLElementTagNameMap['div'] | undefined;",
        '};',
      ].join('\n')
    );
  });
});

describe('runesPropsDestructure', () => {
  it('declares a bindable prop with $bindable, its default inside', () => {
    const destructure =
      runesPropsDestructure(
        {
          value: { type: 'string', default: '', bindable: true },
          open: { type: 'boolean', bindable: true },
          checked: { type: 'boolean', required: true, bindable: true },
          label: { type: 'string' },
        },
        [],
        false
      ) ?? '';
    for (const entry of ["value = $bindable('')", 'open = $bindable(undefined)', 'checked = $bindable()', 'label = undefined']) {
      expect(destructure).toContain(entry);
    }
  });

  it('destructures required props bare, defaults and optionals with values', () => {
    expect(
      runesPropsDestructure(
        {
          imageUrl: { type: 'string', required: true },
          size: { type: 'number', default: 48 },
          pressed: { type: 'boolean' },
        },
        [],
        false
      )
    ).toBe('let { imageUrl, size = 48, pressed = undefined }: Props = $props();');
  });

  it('quotes string defaults as single-quoted literals', () => {
    expect(
      runesPropsDestructure(
        { variant: { type: "'primary' | 'secondary'", default: 'primary' } },
        [],
        false
      )
    ).toBe("let { variant = 'primary' }: Props = $props();");
  });

  it('destructures snippet props bare', () => {
    expect(
      runesPropsDestructure({}, [
        { slotName: 'header', propName: 'header', localName: 'header', exposes: [] },
        { slotName: undefined, propName: 'children', localName: 'children', exposes: [] },
      ], false)
    ).toBe('let { header, children }: Props = $props();');
  });

  it('destructures a shadowed snippet prop under its alias', () => {
    expect(
      runesPropsDestructure({}, [
        { slotName: 'icon', propName: 'icon', localName: 'iconSlot', exposes: [] },
      ], false)
    ).toBe('let { icon: iconSlot }: Props = $props();');
  });

  it('appends the passthrough surface with the class rename, bindable element, and rest', () => {
    expect(runesPropsDestructure({}, [], true)).toBe(
      [
        'let {',
        '  class: className = undefined,',
        '  style = undefined,',
        '  element = $bindable(undefined),',
        '  ...restProperties',
        '}: Props = $props();',
      ].join('\n')
    );
  });

  it('wraps a long destructure one entry per line with a trailing comma', () => {
    expect(
      runesPropsDestructure(
        {
          placeholder: { type: 'string' },
          description: { type: 'string' },
          orientation: { type: "'horizontal' | 'vertical'", default: 'horizontal' },
        },
        [],
        false
      )
    ).toBe(
      [
        'let {',
        '  placeholder = undefined,',
        '  description = undefined,',
        "  orientation = 'horizontal',",
        '}: Props = $props();',
      ].join('\n')
    );
  });

  it('returns undefined when there is nothing to destructure', () => {
    expect(runesPropsDestructure({}, [], false)).toBeUndefined();
  });
});

describe('runes props whose names are not bindable', () => {
  const props = {
    'aria-pressed': { type: 'boolean', default: false },
    for: { type: 'string' },
  };

  it('destructures each under its alias and quotes the interface key', () => {
    expect(runesPropsDestructure(props, [], false)).toBe(
      "let {\n  'aria-pressed': ariaPressed = false,\n  for: forProp = undefined,\n}: Props = $props();"
    );
    expect(runesPropsDeclaration(props, [])).toBe(
      "interface Props {\n  'aria-pressed'?: boolean | undefined;\n  for?: string | undefined;\n}"
    );
  });
});
