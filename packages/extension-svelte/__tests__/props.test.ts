import { describe, expect, it } from 'vitest';

import { exportLetDeclarations } from '../src/props';

describe('exportLetDeclarations', () => {
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
