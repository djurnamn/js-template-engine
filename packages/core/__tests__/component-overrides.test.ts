import { describe, expect, it } from 'vitest';

import { resolveComponentOverrides } from '../src/component-overrides';
import type { NormalizedComponent } from '../src/normalize';

function component(
  extensions: NormalizedComponent['extensions']
): NormalizedComponent {
  return {
    name: 'Alert',
    props: {
      tone: { type: 'string', default: 'info' },
    },
    imports: ["import { palette } from './palette';"],
    script: "const role = 'alert';",
    style: '.alert {\n  border: 1px solid;\n}',
    children: [],
    extensions,
  };
}

describe('resolveComponentOverrides', () => {
  it('returns the component unchanged without an override block', () => {
    const base = component({});
    expect(resolveComponentOverrides(base, 'react')).toBe(base);
  });

  it('merges imports by concatenation with duplicates dropped', () => {
    const resolved = resolveComponentOverrides(
      component({
        react: {
          imports: [
            "import { palette } from './palette';",
            "import { useCallback } from 'react';",
          ],
        },
      }),
      'react'
    );
    expect(resolved.imports).toEqual([
      "import { palette } from './palette';",
      "import { useCallback } from 'react';",
    ]);
  });

  it('merges script and style by appending after a blank line', () => {
    const resolved = resolveComponentOverrides(
      component({
        react: {
          script: 'const handleDismiss = () => {};',
          style: '.alert--react {\n  color: red;\n}',
        },
      }),
      'react'
    );
    expect(resolved.script).toBe(
      "const role = 'alert';\n\nconst handleDismiss = () => {};"
    );
    expect(resolved.style).toBe(
      '.alert {\n  border: 1px solid;\n}\n\n.alert--react {\n  color: red;\n}'
    );
  });

  it('replaces values under the replace strategy', () => {
    const resolved = resolveComponentOverrides(
      component({
        react: {
          style: '.alert {\n  border: 2px dashed;\n}',
          styleStrategy: 'replace',
          imports: [],
          importsStrategy: 'replace',
        },
      }),
      'react'
    );
    expect(resolved.style).toBe('.alert {\n  border: 2px dashed;\n}');
    expect(resolved.imports).toEqual([]);
  });

  it('merges props by spreading with the override winning per key', () => {
    const resolved = resolveComponentOverrides(
      component({
        react: {
          props: {
            tone: { type: 'string', default: 'error' },
            dismissable: { type: 'boolean', default: false },
          },
        },
      }),
      'react'
    );
    expect(resolved.props).toEqual({
      tone: { type: 'string', default: 'error' },
      dismissable: { type: 'boolean', default: false },
    });
  });

  it('ignores override blocks for other extensions', () => {
    const resolved = resolveComponentOverrides(
      component({
        vue: { script: 'const vueOnly = true;' },
      }),
      'react'
    );
    expect(resolved.script).toBe("const role = 'alert';");
  });
});
