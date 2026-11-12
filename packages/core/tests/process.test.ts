import type { ProcessingOptions, ProcessResult, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import {
  isFrameworkExtension,
  isTargetExtension,
  type TargetExtension,
} from '../src/extension';
import { process } from '../src/process';
import { TemplateError } from '../src/TemplateError';

const template: Template = [
  {
    type: 'element',
    tag: 'div',
    children: [{ type: 'text', content: 'Hello' }],
  },
];

function fakeTarget(key: string): TargetExtension {
  return {
    key,
    kind: 'target',
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

  it('delegates rendering to a target extension', () => {
    const result = process(template, { extensions: [fakeTarget('react')] });
    expect(result.files).toEqual([
      { path: 'Component.react', content: 'react' },
    ]);
  });

  it('treats non-target extensions as inert for rendering', () => {
    const result = process(template, { extensions: [{ key: 'bem' }] });
    expect(result.files[0].path).toBe('Component.html');
  });

  it('rejects multiple target extensions', () => {
    expect(() =>
      process(template, {
        extensions: [fakeTarget('react'), fakeTarget('vue')],
      })
    ).toThrow(TemplateError);
  });

  it('rejects stylesheet placements a target declares unsupported', () => {
    const target: TargetExtension = {
      ...fakeTarget('react'),
      unsupportedPlacements: ['inline'],
    };
    expect(() =>
      process(template, {
        extensions: [target],
        styling: { placement: 'inline' },
      })
    ).toThrow(TemplateError);
    expect(
      process(template, { extensions: [target] }).files[0].path
    ).toBe('Component.react');
  });

  it('reads the deprecated unsupportedStrategies.styling when unsupportedPlacements is absent', () => {
    const target: TargetExtension = {
      ...fakeTarget('react'),
      unsupportedStrategies: { styling: ['inline'] },
    };
    expect(() =>
      process(template, {
        extensions: [target],
        styling: { placement: 'inline' },
      })
    ).toThrow("The 'react' extension does not support the 'inline' stylesheet placement");
  });

  it("still accepts a target extension declaring kind 'framework'", () => {
    const legacy: TargetExtension = { ...fakeTarget('react'), kind: 'framework' };
    expect(isTargetExtension(legacy)).toBe(true);
    expect(isFrameworkExtension(legacy)).toBe(true);
    expect(isFrameworkExtension(fakeTarget('vue'))).toBe(true);
    expect(isTargetExtension({ key: 'bem' })).toBe(false);
    expect(process(template, { extensions: [legacy] }).files[0].path).toBe(
      'Component.react'
    );
    expect(() =>
      process(template, { extensions: [legacy, fakeTarget('vue')] })
    ).toThrow('At most one target extension may be passed per process() call; received: react, vue');
  });

  describe('the stylesheet placement', () => {
    const deprecation = {
      message:
        "The 'styling.outputStrategy' option is deprecated and will be removed in 3.0.0; use 'styling.placement', which takes the same values.",
    };

    it('defaults to in-file and resolves onto both resolved fields', () => {
      let seen: { placement: string; outputStrategy: string } | undefined;
      const probe: TargetExtension = {
        ...fakeTarget('probe'),
        render: (component, options) => {
          seen = {
            placement: options.styling.placement,
            outputStrategy: options.styling.outputStrategy,
          };
          return { files: [], warnings: [] };
        },
      };
      process(template, { extensions: [probe] });
      expect(seen).toEqual({ placement: 'in-file', outputStrategy: 'in-file' });
      process(template, {
        extensions: [probe],
        styling: { placement: 'separate-file' },
      });
      expect(seen).toEqual({
        placement: 'separate-file',
        outputStrategy: 'separate-file',
      });
    });

    it('takes the deprecated outputStrategy key with a deprecation warning', () => {
      const styled: Template = [
        { type: 'element', tag: 'div', attributes: { style: { color: 'red' } } },
      ];
      const result = process(styled, {
        styling: { outputStrategy: 'separate-file' },
      });
      expect(result.files.map((file) => file.path)).toEqual([
        'Component.html',
        'Component.css',
      ]);
      expect(result.warnings).toEqual([deprecation]);
    });

    it('adds no warning when placement is passed beside an equal outputStrategy', () => {
      const result = process(template, {
        styling: { placement: 'inline', outputStrategy: 'inline' },
      });
      expect(result.warnings).toEqual([]);
    });

    it('rejects placement and outputStrategy set to different placements', () => {
      expect(() =>
        process(template, {
          styling: { placement: 'inline', outputStrategy: 'separate-file' },
        })
      ).toThrow(
        "'styling.placement' ('inline') and the deprecated 'styling.outputStrategy' ('separate-file') are both set and differ; keep styling.placement"
      );
    });
  });

  describe('a selector holding Sass interpolation', () => {
    const interpolated = {
      type: 'component',
      name: 'Row',
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            class: ['row'],
            style: { '&:not(#{&}--dense)': { gap: '1rem' }, color: 'red' },
          },
          conditionalAttributes: [
            {
              condition: 'dense',
              attributes: {
                class: ['row--dense'],
                style: { '&#{&}--on': { gap: 0 } },
              },
            },
          ],
        },
      ],
    } as unknown as Template;
    const sassWarnings = (options: ProcessingOptions) =>
      process(interpolated, options).warnings.filter((warning) =>
        warning.message.includes('Sass interpolation')
      );

    it('warns, per selector, when no Sass compile reads the styles', () => {
      const warnings = sassWarnings({});
      expect(warnings.map((warning) => warning.nodePath)).toEqual([
        'children[0].attributes.style',
        'children[0].conditionalAttributes[0].attributes.style',
      ]);
      expect(warnings[0].message).toContain("'&:not(#{&}--dense)'");
    });

    it('stays quiet under the scss language', () => {
      expect(
        sassWarnings({
          styling: { language: 'scss', placement: 'separate-file' },
        })
      ).toEqual([]);
    });

    it('says what to do when the element has no class to build on', () => {
      const unclassed: Template = {
        type: 'component',
        name: 'Grid',
        children: [
          {
            type: 'element',
            tag: 'div',
            attributes: { style: { '&:not(#{&}--dense)': { gap: '1rem' } } },
          },
        ],
      };
      const { warnings } = process(unclassed, { extensions: [] });
      const warning = warnings.find((entry) =>
        entry.message.includes('Sass interpolation')
      );
      expect(warning?.message).not.toContain(
        "Set the styling language to 'scss'"
      );
      expect(warning?.message).toContain('give the element a class');
    });

    it('warns on a suffix added to an element with no class', () => {
      const unclassed: Template = {
        type: 'component',
        name: 'Grid',
        children: [
          {
            type: 'element',
            tag: 'div',
            attributes: {
              style: { '&--brand': { gap: '1rem' }, '&:hover': { gap: 0 } },
            },
          },
        ],
      };
      const { warnings } = process(unclassed, { extensions: [] });
      const suffixes = warnings.filter((entry) =>
        entry.message.includes("adds a suffix to '&'")
      );
      expect(suffixes).toHaveLength(1);
      expect(suffixes[0].message).toContain("'&--brand'");
      expect(suffixes[0].nodePath).toBe('children[0].attributes.style');
    });

    it('stays quiet about a suffix on an element with a class', () => {
      const classed: Template = {
        type: 'component',
        name: 'Grid',
        children: [
          {
            type: 'element',
            tag: 'div',
            attributes: {
              class: 'grid',
              style: { '&--brand': { gap: '1rem' } },
            },
          },
        ],
      };
      const { warnings } = process(classed, { extensions: [] });
      expect(
        warnings.filter((entry) => entry.message.includes('suffix'))
      ).toHaveLength(0);
    });

    it('stays quiet when the engine resolved the Sass itself', () => {
      expect(sassWarnings({ styling: { loadPaths: ['.'] } })).toEqual([]);
    });
  });

  describe("the 'scss' styling language reach", () => {
    for (const placement of ['in-file', 'inline'] as const) {
      it(`rejects the html target + scss + ${placement}`, () => {
        expect(() =>
          process(template, { styling: { language: 'scss', placement } })
        ).toThrow(TemplateError);
      });

      it(`rejects a non-compiling target + scss + ${placement}`, () => {
        expect(() =>
          process(template, {
            extensions: [fakeTarget('react')],
            styling: { language: 'scss', placement },
          })
        ).toThrow(TemplateError);
      });

      it(`allows a compiling target + scss + ${placement}`, () => {
        const target: TargetExtension = {
          ...fakeTarget('vue'),
          compilesInDocumentStyles: true,
        };
        expect(
          process(template, {
            extensions: [target],
            styling: { language: 'scss', placement },
          }).files[0].path
        ).toBe('Component.vue');
      });
    }

    it('allows the html target + scss + separate-file', () => {
      const result = process(template, {
        styling: { language: 'scss', placement: 'separate-file' },
      });
      expect(result.files.map((file) => file.path)).toContain('Component.html');
    });
  });

  describe('the deprecated scripting option', () => {
    const deprecation = {
      message:
        "The 'scripting' option is deprecated, has no effect and will be removed in 3.0.0; the html target writes events as comments and emits no script.",
    };

    it('is ignored with a deprecation warning, whatever its values', () => {
      const result = process(template, {
        scripting: { language: 'typescript', outputStrategy: 'inline' },
      });
      expect(result.files.map((file) => file.path)).toEqual(['Component.html']);
      expect(result.warnings).toEqual([deprecation]);
    });

    it('no longer rejects a scripting strategy a target once declared unsupported', () => {
      const target: TargetExtension = {
        ...fakeTarget('react'),
        unsupportedStrategies: { scripting: ['inline'] },
      };
      const result = process(template, {
        extensions: [target],
        scripting: { outputStrategy: 'inline' },
      });
      expect(result.files[0].path).toBe('Component.react');
      expect(result.warnings).toEqual([deprecation]);
    });

    it('adds no warning when it is not passed', () => {
      expect(process(template).warnings).toEqual([]);
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

    // A component carrying a $include whose mixin is defined in the
    // component-level `style` preamble - resolvable under 'css' with no load
    // path, so the engine expands it to flat CSS itself.
    const resolvableInclude: Template = {
      type: 'component',
      name: 'Boxed',
      style: '@mixin boxed { padding: 0.5rem; }',
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { class: ['boxed'], style: { $include: 'boxed' } },
          children: [{ type: 'text', content: 'Hello' }],
        },
      ],
    };

    it("resolves $include under language: 'css' to flat CSS", () => {
      const result = process(resolvableInclude, {
        styling: { language: 'css' },
      });
      const content = result.files.map((file) => file.content).join('\n');
      expect(content).toContain('padding: 0.5rem;');
      expect(content).not.toContain('@include');
      expect(content).not.toContain('@mixin');
    });

    it("resolves $include under the 'inline' strategy", () => {
      const result = process(resolvableInclude, {
        styling: { language: 'css', placement: 'inline' },
      });
      const content = result.files.map((file) => file.content).join('\n');
      // A flat-only resolved style inlines as a `style` attribute.
      expect(content).toContain('style="padding: 0.5rem"');
    });

    it("throws a TemplateError when a $include can't be resolved under 'css'", () => {
      expect(() =>
        process(includeTemplate, { styling: { language: 'css' } })
      ).toThrow(TemplateError);
    });

    it('throws by default (css) when a $include is unresolvable', () => {
      expect(() => process(includeTemplate)).toThrow(TemplateError);
    });

    it("passes $include through verbatim under language: 'scss'", () => {
      const result = process(includeTemplate, {
        styling: { language: 'scss', placement: 'separate-file' },
      });
      const scss = result.files.find((file) => file.path.endsWith('.scss'));
      expect(scss?.content).toContain("@include typography('body');");
    });
  });
});

describe('process and reserved names', () => {
  const box: Template = {
    type: 'component',
    name: 'Box',
    props: { helper: { type: 'string' } },
    children: [{ type: 'element', tag: 'div' }],
  };

  it("validates for the extensions passed, reserving each one's names", () => {
    const reserving = { key: 'reserving', reservedNames: [{ name: 'helper', description: 'a helper' }] };
    expect(() => process(box)).not.toThrow();
    expect(() => process(box, { extensions: [reserving] })).toThrowError(
      "The prop 'helper' takes the name of a helper, which the generated component declares itself; rename the prop (at props.helper)"
    );
  });

  it("hands the target the build's reserved names, which its prop aliases steer clear of", () => {
    let reserved: ReadonlySet<string> | undefined;
    const target: TargetExtension = {
      ...fakeTarget('probe'),
      reservedNames: [{ name: 'probeHelper', description: "the probe's helper" }],
      render: (component) => {
        reserved = component.reservedNames;
        return { files: [], warnings: [] };
      },
    };
    process(template, { extensions: [target] });
    expect(reserved?.has('probeHelper')).toBe(true);
    expect(reserved?.has('bem')).toBe(true);
  });
});

describe('process with reserveNamesOf', () => {
  it("reserves the named extensions' names in validation and in the target's aliases", () => {
    const other = {
      key: 'other',
      reservedNames: [{ name: 'otherHelper', description: "the other target's helper" }],
    };
    let reserved: ReadonlySet<string> | undefined;
    const target: TargetExtension = {
      ...fakeTarget('probe'),
      render: (component) => {
        reserved = component.reservedNames;
        return { files: [], warnings: [] };
      },
    };
    process(template, { extensions: [target], reserveNamesOf: [other] });
    expect(reserved?.has('otherHelper')).toBe(true);
    expect(() =>
      process(
        {
          type: 'component',
          name: 'Box',
          props: { otherHelper: { type: 'string' } },
          children: [],
        },
        { reserveNamesOf: [other] }
      )
    ).toThrowError("The prop 'otherHelper' takes the name of the other target's helper");
  });
});
