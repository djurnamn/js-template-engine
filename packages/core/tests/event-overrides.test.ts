import type { ProcessResult, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import type { TargetExtension } from '../src/extension';
import { process } from '../src/process';

const target: TargetExtension = {
  key: 'stub',
  kind: 'target',
  render: (): ProcessResult => ({ files: [], warnings: [] }),
};

function input(override: Record<string, unknown>): Template {
  return {
    type: 'component',
    name: 'NumberInput',
    children: [
      {
        type: 'element',
        tag: 'input',
        events: [
          { name: 'input', handler: 'handleInput' },
          { name: 'keydown', handler: 'handleKeyDown' },
          { name: 'blur', handler: 'handleBlur' },
        ],
        extensions: { stub: override },
      },
    ],
  } as Template;
}

const warningsOf = (template: Template, extension: TargetExtension = target) =>
  process(template, { extensions: [extension] }).warnings;

describe('events override warnings', () => {
  it('names the events an override leaves out, at the override', () => {
    expect(warningsOf(input({ events: [{ name: 'change', handler: 'handleInput' }] }))).toEqual([
      {
        message:
          'The stub events override on <input> leaves out keydown, blur, which the element declares, so the stub output does not handle them; the override replaces the whole event list, so list each event the element keeps in it; an event of another name replaces a left-out one when it takes the same handler, or when it is change replacing input',
        nodePath: 'children[0].extensions.stub.events',
      },
    ]);
  });

  it('counts an event of another name taking the handler as its replacement', () => {
    expect(
      warningsOf(
        input({
          events: [
            { name: 'change', handler: 'handleInput' },
            { name: 'keydown', handler: 'handleKeyDown' },
            { name: 'blur', handler: 'handleBlur' },
          ],
        })
      )
    ).toEqual([]);
    // Another handler under another name replaces nothing.
    expect(warningsOf(input({ events: [{ name: 'focus', handler: 'other' }, { name: 'keydown', handler: 'k' }, { name: 'blur', handler: 'b' }] })).map(
      (warning) => warning.message
    )).toEqual([expect.stringContaining('leaves out input, which')]);
  });

  it('counts change as the replacement for input, whatever its handler', () => {
    expect(
      warningsOf(
        input({
          events: [
            { name: 'change', handler: '(event) => setText(event.currentTarget.value)' },
            { name: 'keydown', handler: 'handleKeyDown' },
            { name: 'blur', handler: 'handleBlur' },
          ],
        })
      )
    ).toEqual([]);
    // change stands in for input only: a left-out blur still warns.
    expect(
      warningsOf(
        input({
          events: [
            { name: 'change', handler: 'other' },
            { name: 'keydown', handler: 'handleKeyDown' },
          ],
        })
      ).map((warning) => warning.message)
    ).toEqual([expect.stringContaining('leaves out blur, which')]);
    // One change replaces one event: taking blur's handler, it leaves input out.
    expect(
      warningsOf(
        input({
          events: [
            { name: 'change', handler: 'handleBlur' },
            { name: 'keydown', handler: 'handleKeyDown' },
          ],
        })
      ).map((warning) => warning.message)
    ).toEqual([expect.stringContaining('leaves out input, which')]);
  });

  it('matches each declared event of a repeated name on its own', () => {
    const element = (events: unknown[], override: unknown[]): Template =>
      ({
        type: 'component',
        name: 'Form',
        children: [
          {
            type: 'element',
            tag: 'input',
            events,
            extensions: { stub: { events: override } },
          },
        ],
      }) as Template;
    expect(
      warningsOf(
        element(
          [
            { name: 'keydown', handler: 'submit', modifiers: ['enter'] },
            { name: 'keydown', handler: 'cancel', modifiers: ['escape'] },
          ],
          [{ name: 'keyup', handler: 'submit' }]
        )
      ).map((warning) => warning.message)
    ).toEqual([expect.stringContaining('leaves out keydown, which')]);
    expect(
      warningsOf(
        element(
          [
            { name: 'input', handler: 'a' },
            { name: 'input', handler: 'b' },
          ],
          [{ name: 'change', handler: 'x' }]
        )
      ).map((warning) => warning.message)
    ).toEqual([expect.stringContaining('leaves out input, which')]);
    // Both left out, the name is listed once.
    expect(
      warningsOf(
        element(
          [
            { name: 'keydown', handler: 'submit' },
            { name: 'keydown', handler: 'cancel' },
          ],
          [{ name: 'click', handler: 'other' }]
        )
      ).map((warning) => warning.message)
    ).toEqual([expect.stringContaining('leaves out keydown, which')]);
  });

  it('leaves an empty list and other targets alone', () => {
    expect(warningsOf(input({ events: [] }))).toEqual([]);
    expect(warningsOf(input({ events: [{ name: 'click', handler: 'x' }] }), { ...target, key: 'other' })).toEqual([]);
  });
});
