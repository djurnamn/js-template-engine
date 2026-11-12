import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { layerOrderModuleFiles } from '../src/html/styles';
import { process } from '../src/process';
import { TemplateError } from '../src/TemplateError';

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
    for (const placement of ['in-file', 'separate-file', 'inline'] as const) {
      const stylesheet = stylesheetOf(
        process(template, {
          styling: { placement, layer: { name: 'kit.components' } },
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
        styling: { placement: 'inline', layer: { name: 'kit.components' } },
      }
    );
    expect(result.files[0].content).toContain('style="color: white"');
    expect(result.files[0].content).not.toContain('@layer');
  });

  it('hoists sass load at-rules above the layer block, after the order module', () => {
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
          placement: 'separate-file',
          layer: { name: 'kit.components', order: ['kit.base', 'kit.components'] },
        },
      })
    );
    expect(stylesheet).toBe(
      [
        "@use './layer-order' as *;",
        "@use 'sass:color';",
        "@forward 'tokens' with (",
        '  $gap: 1rem',
        ');',
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
              placement: 'separate-file',
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
            placement: 'separate-file',
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
          placement: 'separate-file',
          layer: { name: 'kit.components', order: ['kit.base', 'kit.components'] },
        },
      }
    );
    expect(result.files.map((file) => file.path)).toEqual(['Panel.html', 'Panel.scss']);
    expect(result.files[1].content).toBe("@use 'sass:color';\n");
  });

  describe('the order module under scss', () => {
    const order = ['kit.reset', 'kit.base', 'kit.components'];
    const options = {
      styling: {
        language: 'scss' as const,
        placement: 'separate-file' as const,
        layer: { name: 'kit.components', order },
      },
    };

    it('is emitted beside the stylesheet, holding only the order statement', () => {
      const result = process(template, options);
      expect(result.files.map((file) => file.path)).toEqual([
        'Panel.html',
        'Panel.scss',
        '_layer-order.scss',
      ]);
      expect(result.files[2].content).toBe(
        '@layer kit.reset, kit.base, kit.components;\n'
      );
    });

    it('is loaded first by the stylesheet, which states no order of its own', () => {
      const stylesheet = stylesheetOf(process(template, options));
      expect(stylesheet).toBe(
        [
          "@use './layer-order' as *;",
          '',
          '@layer kit.components {',
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

    it('compiles to CSS that states the order ahead of what a loaded module emits', async () => {
      // A module that emits rules inside one of the layers: loaded ahead of
      // an order statement written in the stylesheet, it would declare the
      // layer first and reverse the cascade.
      const { files } = process(
        { ...template, style: "@use 'tokens';" },
        options
      );
      const sass = await import('sass');
      const modules: Record<string, string> = {
        tokens: '@layer kit.components { .panel-base { margin: 0; } }',
        'layer-order': files[2].content,
      };
      const { css } = sass.compileString(files[1].content, {
        importer: {
          canonicalize: (url) => new URL(`memory:${url.replace(/^\.\//, '')}`),
          load: (url) => ({
            contents: modules[url.pathname],
            syntax: 'scss',
          }),
        },
        style: 'compressed',
      });
      expect(css.startsWith('@layer kit.reset, kit.base, kit.components;')).toBe(
        true
      );
      expect(css.split('@layer kit.reset, kit.base, kit.components;')).toHaveLength(
        2
      );
      expect(css).toContain('.panel-base{margin:0}');
    });

    it("takes no namespace, so a kit module named layer-order loads beside it", async () => {
      // Loaded under its default namespace, the generated module would meet
      // the kit's own `layer-order` module's: "already a module with
      // namespace". The generated module has no members to reach.
      const { files } = process(
        {
          ...template,
          style: "@use 'styles/layer-order';\n\n.panel-outline { outline: layer-order.$outline; }",
        },
        options
      );
      const sass = await import('sass');
      const modules: Record<string, string> = {
        'styles/layer-order': '$outline: 1px solid;',
        'layer-order': files[2].content,
      };
      const { css } = sass.compileString(files[1].content, {
        importer: {
          canonicalize: (url) => new URL(`memory:${url.replace(/^\.\//, '')}`),
          load: (url) => ({
            contents: modules[url.pathname],
            syntax: 'scss',
          }),
        },
        style: 'compressed',
      });
      expect(css.startsWith('@layer kit.reset, kit.base, kit.components;')).toBe(
        true
      );
      expect(css).toContain('.panel-outline{outline:1px solid}');
    });

    it('is not emitted under css, where the stylesheet states the order itself', () => {
      for (const placement of ['separate-file', 'in-file'] as const) {
        const result = process(template, {
          styling: { placement, layer: { name: 'kit.components', order } },
        });
        expect(result.files.map((file) => file.path)).toEqual(
          placement === 'separate-file' ? ['Panel.html', 'Panel.css'] : ['Panel.html']
        );
        expect(stylesheetOf(result)).toMatch(
          /^@layer kit\.reset, kit\.base, kit\.components;\n\n@layer kit\.components \{/
        );
      }
    });

    it("is written for a component file's style block that loads it, and not otherwise", () => {
      const layer = { name: 'kit.components', order };
      expect(
        layerOrderModuleFiles("@use './layer-order' as *;\n\n@layer kit.components {}", {
          language: 'scss',
          layer,
        })
      ).toEqual([
        {
          path: '_layer-order.scss',
          content: '@layer kit.reset, kit.base, kit.components;\n',
        },
      ]);
      expect(
        layerOrderModuleFiles('@layer kit.components {}', { language: 'scss', layer })
      ).toEqual([]);
      expect(
        layerOrderModuleFiles("@use './layer-order' as *;", { language: 'css', layer })
      ).toEqual([]);
    });

    it('is not emitted without an order', () => {
      const result = process(template, {
        styling: {
          language: 'scss',
          placement: 'separate-file',
          layer: { name: 'kit.components' },
        },
      });
      expect(result.files.map((file) => file.path)).toEqual(['Panel.html', 'Panel.scss']);
      expect(result.files[1].content).not.toContain('@use');
    });
  });

  it('rejects a layer that is not an object with a name', () => {
    const withLayer = (layer: unknown) => () =>
      process(template, {
        styling: { layer: layer as { name: string } },
      });
    expect(withLayer('components')).toThrow(TemplateError);
    expect(withLayer('components')).toThrow(
      "'styling.layer' must be an object with a 'name' (such as { name: 'components' }); got the string 'components'"
    );
    expect(withLayer(null)).toThrow("got null");
    expect(withLayer({})).toThrow(
      "'styling.layer.name' must be a non-empty string naming the cascade layer; got no name"
    );
    expect(withLayer({ name: '' })).toThrow('got an empty string');
    expect(withLayer({ name: 'components', order: 'base, components' })).toThrow(
      "'styling.layer.order' must be a list of layer names; got the string 'base, components'"
    );
    expect(withLayer({ name: 'components', order: ['base', 2] })).toThrow(
      'got a list with an entry that is not a non-empty string'
    );
    expect(withLayer({ name: 'components', order: ['base', 'components'] })).not.toThrow();
  });
});
