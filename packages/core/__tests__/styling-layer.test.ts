import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { process } from '../src/process';

const template: Template = {
  type: 'component',
  name: 'Panel',
  children: [
    {
      type: 'element',
      tag: 'section',
      attributes: {
        class: ['panel'],
        style: { color: 'white', '&:hover': { color: 'silver' } },
      },
      children: [{ type: 'text', content: 'Body' }],
    },
  ],
};

/** The stylesheet a run emits, whether as its own file or an in-file block. */
function stylesheetOf(result: { files: { path: string; content: string }[] }): string {
  const separate = result.files.find(
    (file) => file.path.endsWith('.css') || file.path.endsWith('.scss')
  );
  if (separate !== undefined) {
    return separate.content;
  }
  const html = result.files[0].content;
  return html.slice(
    html.indexOf('<style>') + '<style>\n'.length,
    html.indexOf('</style>')
  );
}

describe('cascade layer', () => {
  it('emits rules unlayered when no layer is configured', () => {
    const stylesheet = stylesheetOf(process(template));
    expect(stylesheet).not.toContain('@layer');
    expect(stylesheet).toContain('.panel {');
  });

  it('wraps collected rules in the named layer', () => {
    const stylesheet = stylesheetOf(
      process(template, { styling: { layer: { name: 'kit.components' } } })
    );
    expect(stylesheet).toBe(
      [
        '@layer kit.components {',
        '  .panel {',
        '    color: white;',
        '  }',
        '',
        '  .panel:hover {',
        '    color: silver;',
        '  }',
        '}',
        '',
      ].join('\n')
    );
  });

  it('declares the layer order ahead of the wrapper', () => {
    const stylesheet = stylesheetOf(
      process(template, {
        styling: {
          layer: {
            name: 'kit.components',
            order: ['kit.reset', 'kit.base', 'kit.components'],
          },
        },
      })
    );
    expect(stylesheet).toContain(
      '@layer kit.reset, kit.base, kit.components;\n\n@layer kit.components {'
    );
  });

  it('layers the separate-file stylesheet under every strategy', () => {
    for (const outputStrategy of ['in-file', 'separate-file', 'inline'] as const) {
      const stylesheet = stylesheetOf(
        process(template, {
          styling: { outputStrategy, layer: { name: 'kit.components' } },
        })
      );
      // The `inline` strategy inlines the plain declarations and routes only
      // the nested rule to a stylesheet - which is layered like the rest.
      expect(stylesheet).toContain('@layer kit.components {');
      expect(stylesheet).toContain('.panel:hover');
    }
  });

  it('carries no layer into inline style attributes', () => {
    // A style of plain properties alone inlines under the `inline` strategy;
    // the layer wraps stylesheet rules, and there are none to wrap.
    const result = process(
      {
        type: 'component',
        name: 'Panel',
        children: [
          {
            type: 'element',
            tag: 'section',
            attributes: { class: ['panel'], style: { color: 'white' } },
          },
        ],
      },
      {
        styling: { outputStrategy: 'inline', layer: { name: 'kit.components' } },
      }
    );
    expect(result.files[0].content).toContain('style="color: white"');
    expect(result.files[0].content).not.toContain('@layer');
  });

  it('hoists sass load at-rules above the layer block', () => {
    const scssTemplate: Template = {
      ...template,
      style: [
        "@use 'sass:color';",
        "@forward 'tokens' with (",
        '  $gap: 1rem',
        ');',
        '',
        '$panel-gap: 1rem;',
      ].join('\n'),
    };
    const stylesheet = stylesheetOf(
      process(scssTemplate, {
        styling: {
          language: 'scss',
          outputStrategy: 'separate-file',
          layer: { name: 'kit.components', order: ['kit.base', 'kit.components'] },
        },
      })
    );
    expect(stylesheet).toBe(
      [
        "@use 'sass:color';",
        "@forward 'tokens' with (",
        '  $gap: 1rem',
        ');',
        '',
        '@layer kit.base, kit.components;',
        '',
        '@layer kit.components {',
        '  $panel-gap: 1rem;',
        '',
        '  .panel {',
        '    color: white;',
        '',
        '    &:hover {',
        '      color: silver;',
        '    }',
        '  }',
        '}',
        '',
      ].join('\n')
    );
  });

  it('hoists a leading layer statement above the wrapper', () => {
    // Nesting one would declare sub-layers of the wrapper
    // (`kit.components.kit.reset`) - silently, and invisibly from the source.
    for (const language of ['css', 'scss'] as const) {
      const stylesheet = stylesheetOf(
        process(
          {
            ...template,
            style: '@layer kit.reset, kit.base, kit.components;',
          },
          {
            styling: {
              language,
              outputStrategy: 'separate-file',
              layer: { name: 'kit.components' },
            },
          }
        )
      );
      expect(stylesheet).toMatch(
        /^@layer kit\.reset, kit\.base, kit\.components;\n\n@layer kit\.components \{/
      );
      expect(stylesheet).not.toContain('  @layer kit.reset');
    }
  });

  it('keeps an authored layer block inside the wrapper', () => {
    // The block form is rules, not an order declaration - only the statement
    // form hoists.
    const stylesheet = stylesheetOf(
      process(
        {
          ...template,
          style: '@layer kit.base {\n  .panel { color: black; }\n}',
        },
        {
          styling: {
            outputStrategy: 'separate-file',
            layer: { name: 'kit.components' },
          },
        }
      )
    );
    expect(stylesheet).toMatch(/^@layer kit\.components \{/);
    expect(stylesheet).toContain('  @layer kit.base {');
  });

  it('leaves a stylesheet of nothing but sass loads unwrapped', () => {
    const result = process(
      {
        type: 'component',
        name: 'Panel',
        style: "@use 'sass:color';",
        children: [{ type: 'element', tag: 'section' }],
      },
      {
        styling: {
          language: 'scss',
          outputStrategy: 'separate-file',
          layer: { name: 'kit.components' },
        },
      }
    );
    expect(result.files[1].content).toBe("@use 'sass:color';\n");
  });
});
