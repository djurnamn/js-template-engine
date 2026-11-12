import { describe, expect, it } from 'vitest';

import { definePropsStatement, propsInterface } from '../src/props';

describe('propsInterface', () => {
  it('renders declared props in authored order with optional markers', () => {
    expect(
      propsInterface('Button', {
        label: { type: 'string', required: true },
        variant: { type: "'primary' | 'secondary'", default: 'primary' },
      })
    ).toBe(
      `export interface ButtonProps {\n  label: string;\n  variant?: 'primary' | 'secondary' | undefined;\n}`
    );
  });

  it('types an input\'s autocomplete as a string, which defineProps can infer through', () => {
    expect(propsInterface('Search', {}, 'input')).toBe(
      "export interface SearchProps extends /* @vue-ignore */ Omit<IntrinsicElementAttributes['input'], 'autocomplete'>, /* @vue-ignore */ Partial<Record<'autocomplete', string>>, /* @vue-ignore */ Record<`data${Capitalize<string>}`, unknown> {}"
    );
    expect(propsInterface('Search', { autocomplete: { type: 'string' } }, 'input')).toBe(
      "export interface SearchProps extends /* @vue-ignore */ Omit<IntrinsicElementAttributes['input'], 'autocomplete'>, /* @vue-ignore */ Record<`data${Capitalize<string>}`, unknown> {\n  autocomplete?: string | undefined;\n}"
    );
  });

  it("extends every branch element's attributes on a discriminated surface", () => {
    expect(propsInterface('Input', { visual: { type: 'boolean' } }, ['div', 'input', 'div'])).toBe(
      "export interface InputProps extends /* @vue-ignore */ Omit<IntrinsicElementAttributes['div'], 'visual'>, /* @vue-ignore */ Omit<IntrinsicElementAttributes['input'], 'visual' | 'autocomplete'>, /* @vue-ignore */ Partial<Record<'autocomplete', string>>, /* @vue-ignore */ Record<`data${Capitalize<string>}`, unknown> {\n  visual?: boolean | undefined;\n}"
    );
  });

  it('extends the attributes element without the declared names, kept out of the runtime props', () => {
    expect(
      propsInterface('TextInput', { value: { type: 'string' }, onChange: { type: '(value: string) => void' } }, 'input')
    ).toBe(
      "export interface TextInputProps extends /* @vue-ignore */ Omit<IntrinsicElementAttributes['input'], 'value' | 'onChange' | 'autocomplete'>, /* @vue-ignore */ Partial<Record<'autocomplete', string>>, /* @vue-ignore */ Record<`data${Capitalize<string>}`, unknown> {\n  value?: string | undefined;\n  onChange?: ((value: string) => void) | undefined;\n}"
    );
    expect(propsInterface('Surface', {}, 'div')).toBe(
      "export interface SurfaceProps extends /* @vue-ignore */ Partial<IntrinsicElementAttributes['div']>, /* @vue-ignore */ Record<`data${Capitalize<string>}`, unknown> {}"
    );
  });

  it('quotes a prop name that is not an identifier, in the interface and the destructure', () => {
    expect(
      propsInterface('Field', { 'onUpdate:modelValue': { type: '(value: string) => void' } })
    ).toBe("export interface FieldProps {\n  'onUpdate:modelValue'?: ((value: string) => void) | undefined;\n}");
    expect(
      definePropsStatement('Field', { 'onUpdate:modelValue': { type: '(value: string) => void' } })
    ).toBe("const { 'onUpdate:modelValue': onUpdateModelValue } = defineProps<FieldProps>();");
  });

  it('declares a hyphenated name under its camelized key, the key Vue sets', () => {
    expect(propsInterface('Field', { 'label-id': { type: 'string' } })).toBe(
      'export interface FieldProps {\n  labelId?: string | undefined;\n}'
    );
    expect(
      definePropsStatement('Field', { 'aria-pressed': { type: 'boolean', default: false } })
    ).toBe('const { ariaPressed = false } = defineProps<FieldProps>();');
  });

  // vue-tsc checks an `aria-*` attribute written on a component as written,
  // where it camelizes every other hyphenated name, so the interface admits
  // the hyphenated spelling too, typed as the prop, outside the runtime props.
  it('admits a declared aria-* prop under its hyphenated spelling as well', () => {
    expect(propsInterface('Field', { 'aria-pressed': { type: 'boolean' } })).toBe(
      "export interface FieldProps extends /* @vue-ignore */ Partial<{ 'aria-pressed': boolean | undefined }> {\n  ariaPressed?: boolean | undefined;\n}"
    );
    expect(
      propsInterface(
        'Field',
        {
          'aria-pressed': { type: 'boolean', default: false },
          'aria-label': { type: 'string', required: true },
        },
        'button'
      )
    ).toBe(
      "export interface FieldProps extends /* @vue-ignore */ Omit<IntrinsicElementAttributes['button'], 'aria-pressed' | 'aria-label'>, /* @vue-ignore */ Partial<{ 'aria-pressed': boolean | undefined; 'aria-label': string }>, /* @vue-ignore */ Record<`data${Capitalize<string>}`, unknown> {\n  ariaPressed?: boolean | undefined;\n  ariaLabel: string;\n}"
    );
    expect(
      propsInterface('Field', { 'aria-describedby': { type: 'string' } }, 'label', {
        tag: 'input',
        entries: ['aria-*'],
      })
    ).toContain(
      "/* @vue-ignore */ Partial<{ 'aria-describedby': string | undefined }>, /* @vue-ignore */ Record<`data${Capitalize<string>}`, unknown> {"
    );
  });

  it('destructures a reserved-word prop under its alias, with or without a default', () => {
    expect(
      definePropsStatement('Field', {
        for: { type: 'string' },
        class: { type: 'string', default: 'x' },
      })
    ).toBe("const { for: forProp, class: classProp = 'x' } = defineProps<FieldProps>();");
  });

  it('exports a routed element\'s keys type, so it stays at module scope with the interface', () => {
    expect(
      propsInterface('Switch', { label: { type: 'string' } }, 'label', {
        tag: 'input',
        entries: ['name'],
      })
    ).toMatch(/^export type SwitchRoutedKeys = Exclude<Extract<keyof IntrinsicElementAttributes\['input'\], 'name'>, 'label' \| 'class' \| 'style' \| 'autocomplete'>;\n\nexport interface SwitchProps extends /);
  });

  it('returns undefined when no props are declared', () => {
    expect(propsInterface('Card', {})).toBeUndefined();
  });
});

describe('definePropsStatement', () => {
  it('destructures every declared prop from the defineProps call', () => {
    expect(
      definePropsStatement('Button', {
        label: { type: 'string', required: true },
      })
    ).toBe('const { label } = defineProps<ButtonProps>();');
  });

  it('destructures a declared default inline', () => {
    expect(
      definePropsStatement('Avatar', {
        imageUrl: { type: 'string', required: true },
        size: { type: 'number', default: 48 },
        rounded: { type: 'boolean', default: true },
      })
    ).toBe(
      `const { imageUrl, size = 48, rounded = true } = defineProps<AvatarProps>();`
    );
  });

  it('exports a routed element\'s keys type, so it stays at module scope with the interface', () => {
    expect(
      propsInterface('Switch', { label: { type: 'string' } }, 'label', {
        tag: 'input',
        entries: ['name'],
      })
    ).toMatch(/^export type SwitchRoutedKeys = Exclude<Extract<keyof IntrinsicElementAttributes\['input'\], 'name'>, 'label' \| 'class' \| 'style' \| 'autocomplete'>;\n\nexport interface SwitchProps extends /);
  });

  it('returns undefined when no props are declared', () => {
    expect(definePropsStatement('Card', {})).toBeUndefined();
  });

  it('gives an optional boolean prop an explicit undefined default', () => {
    // Without it, Vue's Boolean casting coerces the absent prop to `false`,
    // diverging from React/Svelte (where it is `undefined`) and breaking a
    // controlled/uncontrolled sentinel such as Zag's `open`.
    expect(
      definePropsStatement('Popout', {
        open: { type: 'boolean' },
      })
    ).toBe(`const { open = undefined } = defineProps<PopoutProps>();`);
  });

  it('treats boolean unioned only with undefined/null as boolean', () => {
    expect(
      definePropsStatement('Popout', {
        open: { type: 'boolean | undefined' },
      })
    ).toBe(`const { open = undefined } = defineProps<PopoutProps>();`);
  });

  it('does not give a non-boolean optional prop an undefined default', () => {
    expect(
      definePropsStatement('Label', {
        text: { type: 'string' },
      })
    ).toBe('const { text } = defineProps<LabelProps>();');
  });

  it('gives a boolean-containing union prop an explicit undefined default', () => {
    // Vue resolves `boolean | string` to runtime types [Boolean, String], which
    // sets the Boolean-cast flag - the absent prop is cast to `false` exactly
    // as for a pure boolean, so it needs the same parity default.
    expect(
      definePropsStatement('Stepper', {
        radius: { type: 'boolean | string' },
      })
    ).toBe(
      `const { radius = undefined } = defineProps<StepperProps>();`
    );
  });

  it('matches boolean unioned with a literal member', () => {
    expect(
      definePropsStatement('Toggle', {
        state: { type: "boolean | 'auto'" },
      })
    ).toBe(
      `const { state = undefined } = defineProps<ToggleProps>();`
    );
  });

  it('gives a literal-false union prop an explicit undefined default', () => {
    // A literal `false` member sets the same Boolean-cast flag as the
    // `boolean` keyword: Vue resolves `false | 'default'` to [Boolean, String].
    expect(
      definePropsStatement('Surface', {
        elevation: { type: "false | 'default' | 'overlay' | 'heavy'" },
      })
    ).toBe(
      `const { elevation = undefined } = defineProps<SurfaceProps>();`
    );
  });

  it('gives a literal-true union prop an explicit undefined default', () => {
    expect(
      definePropsStatement('Toggle', {
        state: { type: "true | 'auto'" },
      })
    ).toBe(
      `const { state = undefined } = defineProps<ToggleProps>();`
    );
  });

  it('does not match a quoted true/false string enum', () => {
    // `'true' | 'false'` is strings only - Vue resolves it to String, no
    // Boolean cast, so no parity default is wanted. The quotes are the
    // distinction; do not "simplify" them away in the matcher.
    expect(
      definePropsStatement('Chip', {
        outline: { type: "'true' | 'false'" },
      })
    ).toBe('const { outline } = defineProps<ChipProps>();');
  });

  it('does not match a boolean nested inside a generic type', () => {
    // `Array<boolean | string>` resolves to the Array runtime type on Vue -
    // no Boolean-cast flag, so no parity default is needed.
    expect(
      definePropsStatement('Matrix', {
        flags: { type: 'Array<boolean | string>' },
      })
    ).toBe('const { flags } = defineProps<MatrixProps>();');
  });

  it('does not match a named type alias', () => {
    // The engine sees only the type string; an alias expanding to a
    // boolean-containing union declares its undefined default explicitly.
    expect(
      definePropsStatement('Toggle', {
        state: { type: 'ToggleState' },
      })
    ).toBe('const { state } = defineProps<ToggleProps>();');
  });

  it('leaves a required boolean prop without a default', () => {
    expect(
      definePropsStatement('Switch', {
        checked: { type: 'boolean', required: true },
      })
    ).toBe('const { checked } = defineProps<SwitchProps>();');
  });

  it('keeps a declared boolean default over the undefined default', () => {
    expect(
      definePropsStatement('Switch', {
        checked: { type: 'boolean', default: false },
      })
    ).toBe(
      `const { checked = false } = defineProps<SwitchProps>();`
    );
  });

  it('mixes real defaults and boolean undefined defaults in authored order', () => {
    expect(
      definePropsStatement('Panel', {
        open: { type: 'boolean' },
        size: { type: 'number', default: 48 },
      })
    ).toBe(
      `const { open = undefined, size = 48 } = defineProps<PanelProps>();`
    );
  });

  it('destructures array and object defaults as literals, which Vue compiles to factories', () => {
    expect(
      definePropsStatement('Card', {
        features: { type: 'string[]', default: [] },
        labels: { type: '{ empty: string }', default: { empty: 'None' } },
      })
    ).toBe(
      "const { features = [], labels = { empty: 'None' } } = defineProps<CardProps>();"
    );
  });

  it('puts each prop on a line of its own when the statement exceeds 80 columns', () => {
    expect(
      definePropsStatement('PricingCard', {
        title: { type: 'string', required: true },
        features: { type: 'string[]', default: [] },
        labels: { type: '{ empty: string }', default: { empty: 'No features listed' } },
      })
    ).toBe(
      "const {\n  title,\n  features = [],\n  labels = { empty: 'No features listed' },\n} = defineProps<PricingCardProps>();"
    );
  });

  it('destructures a prop that cannot be bound by name under its alias, default or not', () => {
    expect(
      definePropsStatement('Field', {
        'onUpdate:modelValue': { type: '(value: string) => void' },
        for: { type: 'string' },
      })
    ).toBe(
      "const {\n  'onUpdate:modelValue': onUpdateModelValue,\n  for: forProp,\n} = defineProps<FieldProps>();"
    );
    expect(
      definePropsStatement('Field', {
        for: { type: 'string', default: 'input' },
        forProp: { type: 'string' },
      })
    ).toBe("const { for: forPropProp = 'input', forProp } = defineProps<FieldProps>();");
  });

  it('applies only the defaults of the defaulted props', () => {
    // A discriminated surface destructures every branch's props but applies
    // only the shared props' defaults and the branch props' declared ones.
    expect(
      definePropsStatement(
        'Input',
        { size: { type: 'number' }, visual: { type: 'true | false' } },
        { size: { type: 'number' } }
      )
    ).toBe('const { size, visual } = defineProps<InputProps>();');
  });

  it('passes type arguments to the props type, counting them toward the line width', () => {
    expect(
      definePropsStatement('List', { items: { type: 'Item[]', required: true } }, undefined, '<Item>')
    ).toBe('const { items } = defineProps<ListProps<Item>>();');
    expect(
      definePropsStatement(
        'List',
        { items: { type: 'Item[]', required: true }, getKey: { type: '(item: Item) => Key' } },
        undefined,
        '<Item, Key, SelectedItem, DisabledItem>'
      )
    ).toBe('const {\n  items,\n  getKey,\n} = defineProps<ListProps<Item, Key, SelectedItem, DisabledItem>>();');
  });
});
