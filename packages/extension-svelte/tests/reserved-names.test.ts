import { TemplateError, validateTemplate } from '@js-template-engine/core';
import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { svelte } from '../src/index';

/** The paths of the errors validating a template for Svelte reports. */
function errorPaths(template: unknown): string[] {
  try {
    validateTemplate(template as Template, { extensions: [svelte()] });
  } catch (error) {
    const templateError = error as TemplateError;
    return (templateError.errors ?? [templateError]).map(
      (detail) => detail.nodePath
    );
  }
  return [];
}

const component = (fields: Record<string, unknown>): unknown => ({
  type: 'component',
  name: 'Toggle',
  children: [{ type: 'element', tag: 'button' }],
  ...fields,
});

describe('Svelte validation', () => {
  it('reserves the names a Svelte component declares, only in a build with Svelte', () => {
    for (const name of [
      'createBem',
      'serializeStyleObject',
      'consumerStyleValue',
      'restProperties',
    ]) {
      const template = component({ props: { [name]: { type: 'string' } } });
      expect(errorPaths(template)).toEqual([`props.${name}`]);
      expect(() => validateTemplate(template as Template)).not.toThrow();
    }
  });

  it('reserves the echo guard of a relayed two-way prop, not of a copy', () => {
    expect(
      errorPaths(
        component({
          props: {
            value: { type: 'string', bindable: { given: 'givenValue', report: 'reportValue' } },
            valueEcho: { type: 'string' },
          },
        })
      )
    ).toEqual(['props.valueEcho']);
    expect(
      errorPaths(
        component({
          props: {
            value: { type: 'string', bindable: { current: 'currentValue', setter: 'setValue' } },
            valueEcho: { type: 'string' },
          },
        })
      )
    ).toEqual([]);
  });

  it('reserves on and once only where an event uses passive or once', () => {
    expect(
      errorPaths(
        component({
          props: { on: { type: 'boolean' }, once: { type: 'boolean' } },
        })
      )
    ).toEqual([]);
    expect(
      errorPaths(
        component({
          props: {
            once: { type: 'boolean' },
            listenerElement: { type: 'string' },
          },
          children: [
            {
              type: 'element',
              tag: 'div',
              events: [{ name: 'click', handler: 'run', modifiers: ['once'] }],
            },
          ],
        })
      )
    ).toEqual(['props.once', 'props.listenerElement']);
  });

  it('checks each mode block and scans its script', () => {
    expect(
      errorPaths(
        component({ extensions: { svelte: { runes: { script: 42 } } } })
      )
    ).toEqual(['extensions.svelte.runes.script']);
    expect(
      errorPaths(
        component({
          props: {
            pressed: {
              type: 'boolean',
              bindable: { current: 'isPressed', setter: 'setPressed' },
            },
          },
          extensions: {
            svelte: { legacy: { script: '$: isPressed = pressed;' } },
          },
        })
      )
    ).toEqual(['extensions.svelte.legacy.script']);
    expect(() =>
      validateTemplate(
        component({
          extensions: { svelte: { runes: { script: 42 } } },
        }) as Template
      )
    ).not.toThrow();
  });
});
