import type { ProcessResult, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import type { FrameworkExtension } from '../src/extension';
import { process } from '../src/process';
import { TemplateError } from '../src/TemplateError';

const template: Template = [
  {
    type: 'element',
    tag: 'div',
    children: [{ type: 'text', content: 'Hello' }],
  },
];

function fakeFramework(key: string): FrameworkExtension {
  return {
    key,
    kind: 'framework',
    render: (component): ProcessResult => ({
      files: [{ path: `${component.name}.${key}`, content: key }],
      warnings: [],
    }),
  };
}

describe('process', () => {
  it('defaults the component name to Component', () => {
    const result = process(template);
    expect(result.files.map((file) => file.path)).toEqual(['Component.html']);
  });

  it('uses the componentName option for bare node arrays', () => {
    const result = process(template, { componentName: 'Greeting' });
    expect(result.files[0].path).toBe('Greeting.html');
  });

  it('prefers the root component node name over the option', () => {
    const result = process(
      { type: 'component', name: 'Card', children: template },
      { componentName: 'Ignored' }
    );
    expect(result.files[0].path).toBe('Card.html');
  });

  it('validates before rendering', () => {
    expect(() => process([{ type: 'text' }] as unknown as Template)).toThrow(
      TemplateError
    );
  });

  it('delegates rendering to a framework extension', () => {
    const result = process(template, { extensions: [fakeFramework('react')] });
    expect(result.files).toEqual([
      { path: 'Component.react', content: 'react' },
    ]);
  });

  it('treats non-framework extensions as inert for rendering', () => {
    const result = process(template, { extensions: [{ key: 'bem' }] });
    expect(result.files[0].path).toBe('Component.html');
  });

  it('rejects multiple framework extensions', () => {
    expect(() =>
      process(template, {
        extensions: [fakeFramework('react'), fakeFramework('vue')],
      })
    ).toThrow(TemplateError);
  });

  it('rejects output strategies a framework declares unsupported', () => {
    const framework: FrameworkExtension = {
      ...fakeFramework('react'),
      unsupportedStrategies: { scripting: ['inline'] },
    };
    expect(() =>
      process(template, {
        extensions: [framework],
        scripting: { outputStrategy: 'inline' },
      })
    ).toThrow(TemplateError);
    expect(
      process(template, { extensions: [framework] }).files[0].path
    ).toBe('Component.react');
  });

  describe("the 'scss' styling language reach", () => {
    for (const outputStrategy of ['in-file', 'inline'] as const) {
      it(`rejects HTML mode + scss + ${outputStrategy}`, () => {
        expect(() =>
          process(template, { styling: { language: 'scss', outputStrategy } })
        ).toThrow(TemplateError);
      });

      it(`rejects a non-compiling framework + scss + ${outputStrategy}`, () => {
        expect(() =>
          process(template, {
            extensions: [fakeFramework('react')],
            styling: { language: 'scss', outputStrategy },
          })
        ).toThrow(TemplateError);
      });

      it(`allows a compiling framework + scss + ${outputStrategy}`, () => {
        const framework: FrameworkExtension = {
          ...fakeFramework('vue'),
          compilesInDocumentStyles: true,
        };
        expect(
          process(template, {
            extensions: [framework],
            styling: { language: 'scss', outputStrategy },
          }).files[0].path
        ).toBe('Component.vue');
      });
    }

    it('allows HTML mode + scss + separate-file', () => {
      const result = process(template, {
        styling: { language: 'scss', outputStrategy: 'separate-file' },
      });
      expect(result.files.map((file) => file.path)).toContain('Component.html');
    });
  });

  describe("the 'typescript' scripting language reach", () => {
    const scriptedTemplate: Template = {
      type: 'component',
      name: 'Counter',
      props: { start: { type: 'number', default: 0 } },
      children: [{ type: 'element', tag: 'div' }],
    };

    for (const outputStrategy of ['in-file', 'inline'] as const) {
      it(`rejects HTML mode + typescript + ${outputStrategy}`, () => {
        expect(() =>
          process(scriptedTemplate, {
            scripting: { language: 'typescript', outputStrategy },
          })
        ).toThrow(TemplateError);
      });
    }

    it('allows HTML mode + typescript + separate-file, typing the prop consts', () => {
      const result = process(scriptedTemplate, {
        scripting: { language: 'typescript', outputStrategy: 'separate-file' },
      });
      const script = result.files.find((file) => file.path === 'Counter.ts');
      expect(script?.content).toContain('const start: number = 0;');
    });

    it('is a no-op for a framework target (it emits TypeScript intrinsically)', () => {
      expect(
        process(scriptedTemplate, {
          extensions: [fakeFramework('react')],
          scripting: { language: 'typescript', outputStrategy: 'in-file' },
        }).files[0].path
      ).toBe('Counter.react');
    });
  });

  describe("the '$include' reach", () => {
    const includeTemplate: Template = [
      {
        type: 'element',
        tag: 'div',
        attributes: { style: { $include: "typography('body')" } },
        children: [{ type: 'text', content: 'Hello' }],
      },
    ];

    it("rejects $include under language: 'css'", () => {
      expect(() =>
        process(includeTemplate, { styling: { language: 'css' } })
      ).toThrow(TemplateError);
    });

    it('rejects $include by default (css)', () => {
      expect(() => process(includeTemplate)).toThrow(TemplateError);
    });

    it("rejects $include under language: 'css' with the inline strategy", () => {
      expect(() =>
        process(includeTemplate, {
          styling: { language: 'css', outputStrategy: 'inline' },
        })
      ).toThrow(TemplateError);
    });

    it('reports the node path of the offending style', () => {
      try {
        process(includeTemplate);
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateError);
        expect((error as TemplateError).nodePath).toBe('children[0].style');
      }
    });

    it("rejects a $include nested inside a selector block under 'css'", () => {
      expect(() =>
        process([
          {
            type: 'element',
            tag: 'div',
            attributes: {
              style: { ':hover': { $include: 'focus-ring()' } },
            },
            children: [{ type: 'text', content: 'Hello' }],
          },
        ])
      ).toThrow(TemplateError);
    });

    it("allows $include under language: 'scss'", () => {
      const result = process(includeTemplate, {
        styling: { language: 'scss', outputStrategy: 'separate-file' },
      });
      const scss = result.files.find((file) => file.path.endsWith('.scss'));
      expect(scss?.content).toContain("@include typography('body');");
    });
  });
});
