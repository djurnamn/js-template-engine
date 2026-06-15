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
});
