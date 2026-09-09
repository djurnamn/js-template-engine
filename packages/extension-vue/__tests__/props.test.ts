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
      `interface ButtonProps {\n  label: string;\n  variant?: 'primary' | 'secondary';\n}`
    );
  });

  it('returns undefined when no props are declared', () => {
    expect(propsInterface('Card', {})).toBeUndefined();
  });
});

describe('definePropsStatement', () => {
  it('emits a bare defineProps call when no prop has a default', () => {
    expect(
      definePropsStatement('Button', {
        label: { type: 'string', required: true },
      })
    ).toBe('defineProps<ButtonProps>();');
  });

  it('wraps in withDefaults when any prop declares a default', () => {
    expect(
      definePropsStatement('Avatar', {
        imageUrl: { type: 'string', required: true },
        size: { type: 'number', default: 48 },
        rounded: { type: 'boolean', default: true },
      })
    ).toBe(
      `withDefaults(defineProps<AvatarProps>(), {\n  size: 48,\n  rounded: true,\n});`
    );
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
    ).toBe(`withDefaults(defineProps<PopoutProps>(), {\n  open: undefined,\n});`);
  });

  it('treats boolean unioned only with undefined/null as boolean', () => {
    expect(
      definePropsStatement('Popout', {
        open: { type: 'boolean | undefined' },
      })
    ).toBe(`withDefaults(defineProps<PopoutProps>(), {\n  open: undefined,\n});`);
  });

  it('does not give a non-boolean optional prop an undefined default', () => {
    expect(
      definePropsStatement('Label', {
        text: { type: 'string' },
      })
    ).toBe('defineProps<LabelProps>();');
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
      `withDefaults(defineProps<StepperProps>(), {\n  radius: undefined,\n});`
    );
  });

  it('matches boolean unioned with a literal member', () => {
    expect(
      definePropsStatement('Toggle', {
        state: { type: "boolean | 'auto'" },
      })
    ).toBe(
      `withDefaults(defineProps<ToggleProps>(), {\n  state: undefined,\n});`
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
      `withDefaults(defineProps<SurfaceProps>(), {\n  elevation: undefined,\n});`
    );
  });

  it('gives a literal-true union prop an explicit undefined default', () => {
    expect(
      definePropsStatement('Toggle', {
        state: { type: "true | 'auto'" },
      })
    ).toBe(
      `withDefaults(defineProps<ToggleProps>(), {\n  state: undefined,\n});`
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
    ).toBe('defineProps<ChipProps>();');
  });

  it('does not match a boolean nested inside a generic type', () => {
    // `Array<boolean | string>` resolves to the Array runtime type on Vue -
    // no Boolean-cast flag, so no parity default is needed.
    expect(
      definePropsStatement('Matrix', {
        flags: { type: 'Array<boolean | string>' },
      })
    ).toBe('defineProps<MatrixProps>();');
  });

  it('does not match a named type alias', () => {
    // The engine sees only the type string; an alias expanding to a
    // boolean-containing union declares its undefined default explicitly.
    expect(
      definePropsStatement('Toggle', {
        state: { type: 'ToggleState' },
      })
    ).toBe('defineProps<ToggleProps>();');
  });

  it('leaves a required boolean prop without a default', () => {
    expect(
      definePropsStatement('Switch', {
        checked: { type: 'boolean', required: true },
      })
    ).toBe('defineProps<SwitchProps>();');
  });

  it('keeps a declared boolean default over the undefined default', () => {
    expect(
      definePropsStatement('Switch', {
        checked: { type: 'boolean', default: false },
      })
    ).toBe(
      `withDefaults(defineProps<SwitchProps>(), {\n  checked: false,\n});`
    );
  });

  it('mixes real defaults and boolean undefined defaults in authored order', () => {
    expect(
      definePropsStatement('Panel', {
        open: { type: 'boolean' },
        size: { type: 'number', default: 48 },
      })
    ).toBe(
      `withDefaults(defineProps<PanelProps>(), {\n  open: undefined,\n  size: 48,\n});`
    );
  });
});
