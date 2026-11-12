import { TemplateError } from '@js-template-engine/core';
import type { ElementNode } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import {
  collectSlotProps,
  discriminatedPropsInterface,
  polymorphicRootOf,
  propsDestructuring,
  propsInterface,
} from '../src/props';

describe('collectSlotProps', () => {
  it('collects slots in document order with the default slot as children', () => {
    expect(
      collectSlotProps(
        [
          {
            type: 'element',
            tag: 'header',
            children: [{ type: 'slot', name: 'header' }],
          },
          { type: 'slot' },
        ],
        {}
      )
    ).toEqual([
      { slotName: 'header', propName: 'header', exposes: [], scopeRequired: false },
      { slotName: undefined, propName: 'children', exposes: [], scopeRequired: false },
    ]);
  });

  it('deduplicates repeated uses of the same slot name', () => {
    expect(
      collectSlotProps([{ type: 'slot' }, { type: 'slot' }], {})
    ).toEqual([{ slotName: undefined, propName: 'children', exposes: [], scopeRequired: false }]);
  });

  it('captures a scoped slot exposes record in normalized form', () => {
    expect(
      collectSlotProps(
        [{ type: 'slot', exposes: { api: 'api', state: { value: 'machine.state', type: 'State' } } }],
        {}
      )
    ).toEqual([
      {
        slotName: undefined,
        propName: 'children',
        exposes: [
          { name: 'api', value: 'api' },
          { name: 'state', value: 'machine.state', type: 'State' },
        ],
        scopeRequired: false,
      },
    ]);
  });

  it('marks a scoped slot that requires its scope', () => {
    expect(
      collectSlotProps(
        [
          {
            type: 'slot',
            name: 'trigger',
            exposes: { triggerProps: 'triggerProps' },
            scopeRequired: true,
          },
        ],
        {}
      )
    ).toEqual([
      {
        slotName: 'trigger',
        propName: 'trigger',
        exposes: [{ name: 'triggerProps', value: 'triggerProps' }],
        scopeRequired: true,
      },
    ]);
  });

  it('types a slot that requires its scope as the render function alone', () => {
    expect(
      propsInterface('Dialog', {}, [
        {
          slotName: 'trigger',
          propName: 'trigger',
          exposes: [
            {
              name: 'triggerProps',
              value: 'triggerProps',
              type: 'Record<string, unknown>',
            },
          ],
          scopeRequired: true,
        },
        {
          slotName: 'actions',
          propName: 'actions',
          exposes: [{ name: 'closeProps', value: 'closeProps' }],
          scopeRequired: false,
        },
      ])
    ).toBe(
      [
        'export interface DialogProps {',
        '  trigger?: ((scope: { triggerProps: Record<string, unknown> }) => ReactNode) | undefined;',
        '  actions?: ReactNode | ((scope: { closeProps: any }) => ReactNode);',
        '}',
      ].join('\n')
    );
  });

  it('rejects two slot names normalizing to the same prop name', () => {
    expect(() =>
      collectSlotProps(
        [{ type: 'slot', name: 'nav-menu' }, { type: 'slot', name: 'navMenu' }],
        {}
      )
    ).toThrowError(TemplateError);
  });

  it('rejects a slot colliding with a declared prop', () => {
    expect(() =>
      collectSlotProps([{ type: 'slot', name: 'header' }], {
        header: { type: 'string' },
      })
    ).toThrowError(TemplateError);
  });
});

describe('props whose names are not bindable', () => {
  const props = {
    'aria-pressed': { type: 'boolean', default: false },
    for: { type: 'string' },
    class: { type: 'string', default: 'x' },
  };

  it('destructures each under a camel-cased alias, with or without a default', () => {
    expect(propsDestructuring(props)).toBe(
      "const { 'aria-pressed': ariaPressed = false, for: forProp, class: classProp = 'x' } = props;"
    );
  });

  it('keeps an alias clear of the other declared and slot prop names', () => {
    expect(
      propsDestructuring(
        { 'aria-label': { type: 'string' }, ariaLabel: { type: 'string' } },
        false,
        ['forProp'],
        true
      )
    ).toBe(
      "const { 'aria-label': ariaLabelProp, ariaLabel, forProp, ...rest } = props;"
    );
  });

  it('takes them out of the passthrough rest under their aliases', () => {
    expect(propsDestructuring({ for: { type: 'string' } }, true)).toBe(
      'const { for: forProp, className, style, ref, ...rest } = props;'
    );
  });

  it('quotes a name that is not an identifier in the props interface', () => {
    expect(propsInterface('Toggle', props, [], 'button')).toBe(
      [
        "export interface ToggleProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-pressed' | 'for' | 'class' | 'children'> {",
        "  'aria-pressed'?: boolean | undefined;",
        '  for?: string | undefined;',
        '  class?: string | undefined;',
        '}',
      ].join('\n')
    );
    expect(
      discriminatedPropsInterface(
        'Toggle',
        { 'aria-pressed': { type: 'boolean' } },
        [{ tag: 'button', props: { visual: { type: 'false' } } }],
        []
      )
    ).toContain("      'aria-pressed'?: boolean | undefined;");
  });
});

describe('discriminatedPropsInterface', () => {
  it('types a presence discriminant `?: undefined` on every member but its own', () => {
    expect(
      discriminatedPropsInterface(
        'Button',
        {},
        [
          { tag: 'a', props: { href: { type: 'string', required: true } } },
          {
            tag: 'button',
            props: {
              href: {
                type: 'undefined',
                description: 'Leave out for a button.',
              },
            },
          },
          { tag: 'span', props: {} },
        ],
        [],
        [{ name: 'href', branch: 0 }]
      )
    ).toBe(
      [
        'export type ButtonProps =',
        "  | (Omit<ComponentPropsWithRef<'a'>, 'href' | 'children'> & {",
        '      href: string;',
        '    })',
        "  | (Omit<ComponentPropsWithRef<'button'>, 'href' | 'children'> & {",
        '      /** Leave out for a button. */',
        '      href?: undefined;',
        '    })',
        "  | (Omit<ComponentPropsWithRef<'span'>, 'href' | 'children'> & {",
        '      href?: undefined;',
        '    });',
      ].join('\n')
    );
  });
});

describe('polymorphicRootOf', () => {
  const root = (
    expression: string,
    componentValued?: boolean
  ): ElementNode => ({
    type: 'element',
    tag: { $expression: expression, default: 'button', componentValued },
    passthrough: true,
  });
  const props = { as: { type: "'button' | 'a'" } };

  it('recognizes a bare prop name, with or without a string fallback', () => {
    for (const expression of ['as', "as ?? 'button'", ' as ?? "button" ']) {
      expect(polymorphicRootOf(root(expression), props)).toEqual({
        propName: 'as',
        typeParameter: {
          name: 'T',
          constraint: "keyof JSX.IntrinsicElements & ('button' | 'a')",
          default: "'button'",
        },
        usesJsxNamespace: true,
        defaultTag: 'button',
      });
    }
  });

  it('leaves any other expression to the default tag', () => {
    for (const expression of [
      "visual ? 'div' : 'button'",
      "as ?? fallback",
      'tag',
      "as || 'button'",
    ]) {
      expect(polymorphicRootOf(root(expression), props)).toBeUndefined();
    }
    expect(
      polymorphicRootOf(
        { type: 'element', tag: 'button', passthrough: true },
        props
      )
    ).toBeUndefined();
    expect(polymorphicRootOf(undefined, props)).toBeUndefined();
  });

  it('widens a component-valued tag to ElementType', () => {
    expect(
      polymorphicRootOf(root("as ?? 'button'", true), { as: { type: 'any' } })
        ?.typeParameter.constraint
    ).toBe('ElementType');
    expect(
      polymorphicRootOf(root('as', true), props)?.typeParameter.constraint
    ).toBe("ElementType & ('button' | 'a')");
  });

  it('constrains an untyped intrinsic tag to the tag names', () => {
    expect(
      polymorphicRootOf(root('as'), { as: { type: 'unknown' } })?.typeParameter
        .constraint
    ).toBe('keyof JSX.IntrinsicElements');
    expect(
      polymorphicRootOf(root('as'), { as: { type: 'string' } })?.typeParameter
        .constraint
    ).toBe('keyof JSX.IntrinsicElements & string');
  });

  it('adds a default tag the authored type leaves out', () => {
    expect(
      polymorphicRootOf(root("as ?? 'button'"), { as: { type: "'a' | 'span'" } })
        ?.typeParameter
    ).toEqual({
      name: 'T',
      constraint: "keyof JSX.IntrinsicElements & ('a' | 'span' | 'button')",
      default: "'button'",
    });
  });

  it("follows the prop's own string default", () => {
    expect(
      polymorphicRootOf(root('as'), {
        as: { type: "'button' | 'a'", default: 'a' },
      })?.typeParameter
    ).toEqual({
      name: 'T',
      constraint: "keyof JSX.IntrinsicElements & ('button' | 'a')",
      default: "'a'",
    });
  });

  it("avoids the component's own type parameter names", () => {
    expect(
      polymorphicRootOf(root('as'), props, [{ name: 'T' }, { name: 'T2' }])
        ?.typeParameter.name
    ).toBe('T3');
  });

  it('types the props by the type parameter', () => {
    const polymorphic = polymorphicRootOf(root('as'), props)!;
    expect(
      propsInterface(
        'Button',
        { as: { type: "'button' | 'a'", default: 'button' } },
        [{ slotName: undefined, propName: 'children', exposes: [], scopeRequired: false }],
        'button',
        undefined,
        polymorphic
      )
    ).toBe(
      [
        "export type ButtonProps = Omit<ComponentPropsWithRef<T>, 'as' | 'children'> & {",
        '  as?: T | undefined;',
        '  children?: ReactNode;',
        '};',
      ].join('\n')
    );
  });
});
