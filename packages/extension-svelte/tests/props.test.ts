import { TemplateError } from '@js-template-engine/core';
import { describe, expect, it } from 'vitest';

import { exportLetDeclarations } from '../src/props';

describe('exportLetDeclarations', () => {
  it('parenthesizes an optional function or conditional type before widening it', () => {
    expect(
      exportLetDeclarations({
        onChange: { type: '(value: string) => void' },
        getLabel: { type: '(item: Item) => string | undefined' },
        pick: { type: "T extends string ? 'text' : 'other'" },
        render: { type: 'Array<(row: Row) => string>' },
        label: { type: 'string | undefined' },
      })
    ).toBe(
      [
        'export let onChange: ((value: string) => void) | undefined = undefined;',
        'export let getLabel: ((item: Item) => string | undefined) | undefined = undefined;',
        "export let pick: (T extends string ? 'text' : 'other') | undefined = undefined;",
        'export let render: Array<(row: Row) => string> | undefined = undefined;',
        'export let label: string | undefined = undefined;',
      ].join('\n')
    );
  });

  it('renders declared props in authored order, defaults appended', () => {
    expect(
      exportLetDeclarations({
        imageUrl: { type: 'string', required: true },
        size: { type: 'number', default: 48 },
        rounded: { type: 'boolean', default: true },
      })
    ).toBe(
      [
        'export let imageUrl: string;',
        'export let size: number = 48;',
        'export let rounded: boolean = true;',
      ].join('\n')
    );
  });

  it('defaults an optional prop without a default to undefined', () => {
    expect(
      exportLetDeclarations({
        label: { type: 'string' },
      })
    ).toBe('export let label: string | undefined = undefined;');
  });

  it('does not double `| undefined` when the type already admits it', () => {
    expect(
      exportLetDeclarations({
        open: { type: 'boolean | undefined' },
      })
    ).toBe('export let open: boolean | undefined = undefined;');
  });

  it('quotes string defaults as single-quoted literals', () => {
    expect(
      exportLetDeclarations({
        variant: { type: "'primary' | 'secondary'", default: 'primary' },
      })
    ).toBe("export let variant: 'primary' | 'secondary' = 'primary';");
  });

  it('returns undefined when no props are declared', () => {
    expect(exportLetDeclarations({})).toBeUndefined();
  });
});

describe('legacy props whose names are not bindable', () => {
  it('declares a reserved-word prop under its alias and exports it under its name', () => {
    expect(
      exportLetDeclarations({
        for: { type: 'string', required: true },
        class: { type: 'string', default: 'x' },
      })
    ).toBe(
      [
        'let forProp: string;',
        'export { forProp as for };',
        "let classProp: string = 'x';",
        'export { classProp as class };',
      ].join('\n')
    );
  });

  it('rejects a name that is not an identifier, pointing to runes mode', () => {
    expect(() =>
      exportLetDeclarations({ 'aria-pressed': { type: 'boolean' } })
    ).toThrowError(TemplateError);
    expect(() =>
      exportLetDeclarations({ 'aria-pressed': { type: 'boolean' } })
    ).toThrowError(
      "Build the svelte target in runes mode (svelte({ mode: 'runes' }), --svelte-mode runes, or svelte: { mode: 'runes' } in a kit's configuration), which reads it as 'ariaPressed'"
    );
  });

  it("rejects a prop named 'default', which no module export can declare, pointing to runes mode", () => {
    expect(() =>
      exportLetDeclarations({ default: { type: 'string', default: 'x' } })
    ).toThrowError(TemplateError);
    expect(() =>
      exportLetDeclarations({ default: { type: 'string', default: 'x' } })
    ).toThrowError(
      "Legacy Svelte cannot declare a prop named 'default': a legacy component exports its props from its module, which may have no default export. Build the svelte target in runes mode (svelte({ mode: 'runes' }), --svelte-mode runes, or svelte: { mode: 'runes' } in a kit's configuration), which reads it as 'defaultProp', or rename the prop"
    );
  });

  it("carries the prop's path, a discriminated branch's included", () => {
    let caught: unknown;
    try {
      exportLetDeclarations(
        { 'aria-pressed': { type: 'boolean' } },
        undefined,
        new Map([['aria-pressed', 'children[0].conditions[1].props.aria-pressed']])
      );
    } catch (error) {
      caught = error;
    }
    expect((caught as TemplateError).nodePath).toBe(
      'children[0].conditions[1].props.aria-pressed'
    );
  });
});
