import { TemplateError, validateTemplate } from '@js-template-engine/core';
import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { react } from '../src/index';

/** The paths of the errors validating a template for React reports. */
function errorPaths(template: unknown): string[] {
  try {
    validateTemplate(template as Template, { extensions: [react()] });
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
const pressed = {
  type: 'boolean',
  bindable: { current: 'isPressed', setter: 'setPressed' },
};

describe('React reserved names', () => {
  it('reserves the names a React component declares, only in a build with React', () => {
    for (const name of [
      'props',
      'componentStyles',
      'useBem',
      'Fragment',
      'routedRest',
      'surfaceProperties',
    ]) {
      const template = component({ props: { [name]: { type: 'string' } } });
      expect(errorPaths(template)).toEqual([`props.${name}`]);
      expect(() => validateTemplate(template as Template)).not.toThrow();
    }
  });

  it("reserves each two-way prop's setter and ref, which a derived value may not read", () => {
    expect(
      errorPaths(
        component({ props: { pressed, setOwnPressed: { type: 'string' } } })
      )
    ).toEqual(['props.setOwnPressed']);
    expect(() =>
      validateTemplate(
        component({
          props: { pressed },
          derived: { label: 'String(latestPressed)' },
        }) as Template,
        { extensions: [react()] }
      )
    ).toThrowError(
      "The derived value 'label' reads 'latestPressed', React's ref holding the latest 'pressed', which one target generates for itself; read the two-way value instead"
    );
  });

  it('reserves the hooks the ids and two-way props import', () => {
    expect(errorPaths(component({ ids: { useId: 'toggle' } }))).toEqual([
      'ids.useId',
    ]);
    expect(
      errorPaths(
        component({ props: { pressed }, derived: { useState: 'isPressed' } })
      )
    ).toEqual(['derived.useState']);
  });
});
