import { TemplateError, validateTemplate } from '@js-template-engine/core';
import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { vue } from '../src';

/** The paths of the errors validating a template for Vue reports. */
function errorPaths(template: unknown): string[] {
  try {
    validateTemplate(template as Template, { extensions: [vue()] });
  } catch (error) {
    const templateError = error as TemplateError;
    return (templateError.errors ?? [templateError]).map(
      (detail) => detail.nodePath
    );
  }
  return [];
}

const toggle = (
  props: Record<string, unknown>,
  extra: Record<string, unknown> = {}
): unknown => ({
  type: 'component',
  name: 'Toggle',
  props,
  children: [{ type: 'element', tag: 'button' }],
  ...extra,
});
const pressed = {
  type: 'boolean',
  bindable: { current: 'isPressed', setter: 'setPressed' },
};

describe('Vue validation', () => {
  it('reserves the names a Vue component declares, only in a build with Vue', () => {
    for (const name of [
      'createBem',
      'definedProperties',
      'routedElement',
      'vRoutedElement',
      'unlessDefaultPrevented',
      'usedOnceListeners',
      'claimOnceListener',
      'useAttrs',
      'mergeProps',
    ]) {
      const template = toggle({ [name]: { type: 'string' } });
      expect(errorPaths(template)).toEqual([`props.${name}`]);
      expect(() => validateTemplate(template as Template)).not.toThrow();
    }
  });

  it('reserves shallowRef beside a routed handle, which imports it, and not beside ids', () => {
    const field = (handle?: 'routed'): unknown => ({
      type: 'component',
      name: 'Field',
      props: { shallowRef: { type: 'string' } },
      children: [
        {
          type: 'element',
          tag: 'label',
          passthrough: true,
          children: [
            {
              type: 'element',
              tag: 'input',
              passthrough: { attributes: ['*'], ...(handle ? { handle } : {}) },
            },
          ],
        },
      ],
    });
    expect(errorPaths(field('routed'))).toEqual(['props.shallowRef']);
    expect(errorPaths(field())).toEqual([]);
    expect(
      errorPaths(
        toggle({ shallowRef: { type: 'string' } }, { ids: { label: 'label' } })
      )
    ).toEqual([]);
  });

  it('reserves emit beside two-way props, and a derived value may not read it', () => {
    expect(errorPaths(toggle({ pressed, emit: { type: 'string' } }))).toEqual([
      'props.emit',
    ]);
    expect(() =>
      validateTemplate(
        toggle({ pressed }, { derived: { label: 'String(emit)' } }) as Template,
        { extensions: [vue()] }
      )
    ).toThrowError(
      "The derived value 'label' reads 'emit', Vue's emit function for the two-way props, which one target generates for itself; read the two-way value instead"
    );
  });

  it("reserves each two-way prop's latest-value record in a Vue-only build", () => {
    const value = {
      type: 'string',
      bindable: { current: 'current', setter: 'setValue' },
    };
    const field = (props: Record<string, unknown>, extra = {}) => ({
      type: 'component',
      name: 'Field',
      props,
      children: [{ type: 'element', tag: 'input' }],
      ...extra,
    });
    expect(
      errorPaths(field({ value, latestValue: { type: 'string' } }))
    ).toEqual(['props.latestValue']);
    expect(
      errorPaths(field({ value }, { script: 'const latestValue = 1;' }))
    ).toEqual(['script']);
    expect(
      errorPaths(field({ value }, { derived: { latestValue: 'current' } }))
    ).toEqual(['derived.latestValue']);
    expect(
      errorPaths(field({ value }, { ids: { latestValue: 'field' } }))
    ).toEqual(['ids.latestValue']);
    expect(
      errorPaths(
        field({
          value: {
            ...value,
            bindable: { current: 'latestValue', setter: 'setValue' },
          },
        })
      )
    ).toEqual(['props.value.bindable.current']);
    expect(() =>
      validateTemplate(
        field(
          { value },
          { derived: { label: 'String(latestValue)' } }
        ) as Template,
        {
          extensions: [vue()],
        }
      )
    ).toThrowError(
      "reads 'latestValue', Vue's record of the latest 'value', which one target generates for itself"
    );
  });

  it('accepts extensions.vue.model naming one two-way prop, and rejects anything else', () => {
    expect(
      errorPaths(
        toggle({ pressed }, { extensions: { vue: { model: 'pressed' } } })
      )
    ).toEqual([]);
    expect(
      errorPaths(
        toggle(
          { pressed },
          { extensions: { vue: { model: ['pressed', 'open'] } } }
        )
      )
    ).toEqual(['extensions.vue.model']);
    expect(
      errorPaths(
        toggle(
          { pressed: { type: 'boolean', bindable: true } },
          { extensions: { vue: { model: 'pressed' } } }
        )
      )
    ).toEqual(['extensions.vue.model']);
    expect(
      errorPaths(
        toggle(
          { pressed, modelValue: { type: 'boolean' } },
          { extensions: { vue: { model: 'pressed' } } }
        )
      )
    ).toEqual(['props.modelValue']);
    // Without Vue in the build, its override is its own business.
    expect(() =>
      validateTemplate(
        toggle({ pressed }, { extensions: { vue: { model: 42 } } }) as Template
      )
    ).not.toThrow();
  });

  it("rejects a Vue script's own defineEmits beside two-way props, read only as a call outside comments", () => {
    expect(
      errorPaths(
        toggle(
          { pressed },
          { extensions: { vue: { script: 'defineEmits<{ close: [] }>();' } } }
        )
      )
    ).toEqual(['extensions.vue.script']);
    expect(
      errorPaths(
        toggle({ pressed }, { script: "const emits = defineEmits(['close']);" })
      )
    ).toEqual(['script']);
    // Assigning it to emit is reported once, for the defineEmits.
    expect(
      errorPaths(
        toggle(
          { pressed },
          {
            extensions: {
              vue: { script: 'const emit = defineEmits<{ close: [] }>();' },
            },
          }
        )
      )
    ).toEqual(['extensions.vue.script']);
    expect(
      errorPaths(
        toggle(
          { pressed },
          {
            extensions: {
              vue: {
                script: '// no defineEmits() here\nconst defineEmitsCount = 0;',
              },
            },
          }
        )
      )
    ).toEqual([]);
    expect(
      errorPaths(
        toggle(
          {},
          { extensions: { vue: { script: 'defineEmits<{ close: [] }>();' } } }
        )
      )
    ).toEqual([]);
  });

  it('rejects two props Vue would declare under one camelized key', () => {
    expect(
      errorPaths(
        toggle({
          'aria-pressed': { type: 'boolean' },
          ariaPressed: { type: 'boolean' },
        })
      )
    ).toEqual(['props.ariaPressed']);
    expect(
      errorPaths(
        toggle(
          { 'aria-pressed': { type: 'boolean' } },
          {
            extensions: {
              react: { props: { ariaPressed: { type: 'boolean' } } },
            },
          }
        )
      )
    ).toEqual([]);
  });
});
