import { describe, it, expect, vi } from 'vitest';
import { TemplateEngine } from '../src/engine/TemplateEngine';
import type { ExtendedTemplate, RenderOptions, TemplateNode, Extension } from '@js-template-engine/types';
import type { TemplateOptions } from '../src/types';

describe('TemplateEngine - Component Rendering', () => {
  it('should handle ExtendedTemplate with component metadata', async () => {
    const engine = new TemplateEngine();
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello World'
        }]
      }],
      component: {
        name: 'TestComponent',
        props: {
          message: 'Hello World'
        },
        script: `
          function handleClick() {
            console.log('clicked');
          }
        `
      }
    };

    const options: RenderOptions = {
      fileExtension: '.html'
    } as TemplateOptions;

    const result = await engine.render(template, options);
    expect(result.output).toBe(`<div>Hello World</div>
<script>
          function handleClick() {
            console.log('clicked');
          }
</script>`);
    expect(result.errors).toEqual([]);
  });

  it('should handle vanilla script imports', async () => {
    const engine = new TemplateEngine();
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello World'
        }]
      }],
      component: {
        name: 'VanillaComponent',
        imports: [
          'import { debounce } from "lodash"',
          'import { format } from "date-fns"'
        ],
        script: `
          const debouncedClick = debounce(() => {
            console.log('clicked at', format(new Date(), 'HH:mm:ss'));
          }, 300);
        `
      }
    };

    const options: RenderOptions = {
      fileExtension: '.html'
    } as TemplateOptions;

    const result = await engine.render(template, options);
    expect(result.output).toBe(`<div>Hello World</div>
<script>
import { debounce } from "lodash"
import { format } from "date-fns"

          const debouncedClick = debounce(() => {
            console.log('clicked at', format(new Date(), 'HH:mm:ss'));
          }, 300);
</script>`);
    expect(result.errors).toEqual([]);
  });

  it('should pass component metadata to rootHandler when provided', async () => {
    const mockRootHandler = vi.fn((template: string, options: RenderOptions, context: any) => {
      expect(context.component).toBeDefined();
      expect(context.component.name).toBe('TestComponent');
      expect(context.component.props).toEqual({ message: 'Hello World' });
      return template;
    });

    const engine = new TemplateEngine([{
      key: 'test',
      rootHandler: mockRootHandler
    }]);

    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello World'
        }]
      }],
      component: {
        name: 'TestComponent',
        props: {
          message: 'Hello World'
        }
      }
    };

    const options: RenderOptions = {
      fileExtension: '.html',
      extensions: [{
        key: 'test',
        rootHandler: mockRootHandler
      }]
    } as TemplateOptions;

    await engine.render(template, options);
    expect(mockRootHandler).toHaveBeenCalled();
  });

  it('should handle ExtendedTemplate with nested components', async () => {
    const engine = new TemplateEngine();
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [
          {
            type: 'element',
            tag: 'header',
            children: [{
              type: 'text',
              content: 'Header'
            }]
          },
          {
            type: 'element',
            tag: 'main',
            children: [{
              type: 'text',
              content: 'Content'
            }]
          }
        ]
      }],
      component: {
        name: 'LayoutComponent',
        props: {
          title: 'Test Layout'
        },
        script: `
          function handleLayoutChange() {
            console.log('layout changed');
          }
        `
      }
    };

    const options: RenderOptions = {
      fileExtension: '.html'
    } as TemplateOptions;

    const result = await engine.render(template, options);
    expect(result.output).toBe(`<div><header>Header</header><main>Content</main></div>
<script>
          function handleLayoutChange() {
            console.log('layout changed');
          }
</script>`);
    expect(result.errors).toEqual([]);
  });

  it('should handle ExtendedTemplate with style definitions', async () => {
    const engine = new TemplateEngine();
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          style: {
            color: 'red',
            fontSize: '16px'
          }
        },
        children: [{
          type: 'text',
          content: 'Styled Content'
        }]
      }],
      component: {
        name: 'StyledComponent',
        props: {
          theme: 'light'
        }
      }
    };

    const options: RenderOptions = {
      fileExtension: '.html',
      styles: {
        outputFormat: 'inline'
      }
    } as TemplateOptions;

    const result = await engine.render(template, options);
    expect(result.output).toBe('<div style="color: red; font-size: 16px">Styled Content</div>');
    expect(result.errors).toEqual([]);
  });

  it('should handle ExtendedTemplate with imports', async () => {
    const engine = new TemplateEngine();
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Imported Component'
        }]
      }],
      component: {
        name: 'ImportComponent',
        imports: [
          'import { foo } from "bar"',
          'import { baz } from "bar"'
        ]
      }
    };

    const options: RenderOptions = {
      fileExtension: '.html'
    } as TemplateOptions;

    const result = await engine.render(template, options);
    expect(result.output).toBe(`<div>Imported Component</div>
<script>
import { foo } from "bar"
import { baz } from "bar"
</script>`);
    expect(result.errors).toEqual([]);
  });

  it('should handle ExtendedTemplate with version metadata', async () => {
    const mockRootHandler = vi.fn((template: string, options: RenderOptions, context: any) => {
      expect(context.version).toBe('1.0.0');
      return template;
    });

    const engine = new TemplateEngine([{
      key: 'test',
      rootHandler: mockRootHandler
    }]);

    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Versioned Component'
        }]
      }],
      component: {
        name: 'VersionComponent'
      },
      version: '1.0.0'
    };

    const options: RenderOptions = {
      fileExtension: '.html',
      extensions: [{
        key: 'test',
        rootHandler: mockRootHandler
      }]
    } as TemplateOptions;

    await engine.render(template, options);
    expect(mockRootHandler).toHaveBeenCalled();
  });

  describe('Edge Cases', () => {
    it('should handle template with only component metadata', async () => {
      const engine = new TemplateEngine();
      const template: ExtendedTemplate = {
        template: [],
        component: {
          name: 'OnlyComponent'
        }
      };

      const options: RenderOptions = {
        fileExtension: '.html'
      } as TemplateOptions;

      const result = await engine.render(template, options);
      expect(result.output).toBe('');
      expect(result.errors).toEqual([]);
    });

    it('should handle complex component props', async () => {
      const engine = new TemplateEngine();
      const template: ExtendedTemplate = {
        template: [{
          type: 'element',
          tag: 'div',
          children: [{
            type: 'text',
            content: 'Complex Props'
          }]
        }],
        component: {
          name: 'ComplexPropsComponent',
          props: {
            count: '0',
            onClick: '() => {}',
            config: '{"theme":"dark"}'
          }
        }
      };

      const options: RenderOptions = {
        fileExtension: '.html'
      } as TemplateOptions;

      const result = await engine.render(template, options);
      expect(result.output).toMatchInlineSnapshot(`"<div>Complex Props</div>"`);
      expect(result.errors).toEqual([]);
    });

    it('should handle missing component name gracefully', async () => {
      const engine = new TemplateEngine();
      const template: ExtendedTemplate = {
        template: [],
        component: {
          props: { message: 'Hello' }
        }
      };

      const options: RenderOptions = {
        fileExtension: '.html'
      } as TemplateOptions;

      await expect(engine.render(template, options)).resolves.not.toThrow();
    });

    it('should handle malformed component metadata', async () => {
      const engine = new TemplateEngine();
      const template: ExtendedTemplate = {
        template: [],
        component: {} as any
      };

      const options: RenderOptions = {
        fileExtension: '.html'
      } as TemplateOptions;

      await expect(engine.render(template, options)).resolves.not.toThrow();
    });

    it('should handle non-array template', async () => {
      const engine = new TemplateEngine();
      const template = {
        template: { type: 'element', tag: 'div' },
        component: {
          name: 'InvalidTemplateComponent'
        }
      } as unknown as ExtendedTemplate;

      const options = {
        fileExtension: '.html'
      } as TemplateOptions;

      const result = await engine.render(template, options);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toMatch(/is not iterable/i);
      expect(result.output).toBe('');
    });
  });

  describe('Template-Only Behavior', () => {
    it('should handle raw array of template nodes', async () => {
      const engine = new TemplateEngine();
      const template: TemplateNode[] = [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Array Input'
        }]
      }];

      const options: RenderOptions = {
        fileExtension: '.html'
      } as TemplateOptions;

      const result = await engine.render(template, options);
      expect(result.output).toMatchInlineSnapshot(`"<div>Array Input</div>"`);
      expect(result.errors).toEqual([]);
    });

    it('should handle template without component metadata', async () => {
      const engine = new TemplateEngine();
      const template = {
        template: [{
          type: 'element',
          tag: 'div',
          children: [{
            type: 'text',
            content: 'No Component'
          }]
        }]
      } as ExtendedTemplate;

      const options: RenderOptions = {
        fileExtension: '.html'
      } as TemplateOptions;

      const result = await engine.render(template, options);
      expect(result.output).toMatchInlineSnapshot(`"<div>No Component</div>"`);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Internal Flow', () => {
    it('should process nodes through extensions', async () => {
      // Add a dummy extension so nodeHandler is called
      const dummyExtension = {
        key: 'dummy',
        nodeHandler: vi.fn((node: TemplateNode) => node)
      };
      const engine = new TemplateEngine([dummyExtension]);

      const template: ExtendedTemplate = {
        template: [{
          type: 'element',
          tag: 'div',
          children: [
            {
              type: 'element',
              tag: 'span',
              children: [{
                type: 'text',
                content: 'Nested'
              }]
            }
          ]
        }],
        component: {
          name: 'NestedComponent'
        }
      };

      const options: RenderOptions = {
        fileExtension: '.html'
      } as TemplateOptions;

      await engine.render(template, options);
      expect(dummyExtension.nodeHandler).toHaveBeenCalled();
    });

    it('should apply extensions in correct order', async () => {
      const extensionOrder: string[] = [];
      const engine = new TemplateEngine([
        {
          key: 'first',
          nodeHandler: (node: TemplateNode) => {
            extensionOrder.push('first-node');
            return node;
          },
          beforeRender: () => extensionOrder.push('first-before'),
          afterRender: () => extensionOrder.push('first-after'),
          onNodeVisit: () => extensionOrder.push('first-visit')
        },
        {
          key: 'second',
          nodeHandler: (node: TemplateNode) => {
            extensionOrder.push('second-node');
            return node;
          },
          beforeRender: () => extensionOrder.push('second-before'),
          afterRender: () => extensionOrder.push('second-after'),
          onNodeVisit: () => extensionOrder.push('second-visit')
        }
      ]);

      const template: ExtendedTemplate = {
        template: [{
          type: 'element',
          tag: 'div',
          children: [{
            type: 'text',
            content: 'Extension Order'
          }]
        }],
        component: {
          name: 'ExtensionOrderComponent'
        }
      };

      const options: RenderOptions = {
        fileExtension: '.html'
      } as TemplateOptions;

      await engine.render(template, options);

      // Check beforeRender order
      const firstBeforeIndex = extensionOrder.indexOf('first-before');
      const secondBeforeIndex = extensionOrder.indexOf('second-before');
      expect(firstBeforeIndex).toBeLessThan(secondBeforeIndex);

      // Check nodeHandler order
      const firstNodeIndex = extensionOrder.indexOf('first-node');
      const secondNodeIndex = extensionOrder.indexOf('second-node');
      expect(firstNodeIndex).toBeLessThan(secondNodeIndex);

      // Check onNodeVisit order
      const firstVisitIndex = extensionOrder.indexOf('first-visit');
      const secondVisitIndex = extensionOrder.indexOf('second-visit');
      expect(firstVisitIndex).toBeLessThan(secondVisitIndex);

      // Check afterRender order
      const firstAfterIndex = extensionOrder.indexOf('first-after');
      const secondAfterIndex = extensionOrder.indexOf('second-after');
      expect(firstAfterIndex).toBeLessThan(secondAfterIndex);

      // Verify counts - Based on actual debug output:
      // - nodeHandler is called for each extension on each node (chained, so 2 nodes × 2 extensions = 2 calls per extension)
      // - onNodeVisit is called for each extension on each node (actual count is 2 calls per extension)
      expect(extensionOrder.filter(x => x === 'first-node').length).toBe(2);
      expect(extensionOrder.filter(x => x === 'second-node').length).toBe(2);
      expect(extensionOrder.filter(x => x === 'first-visit').length).toBe(2);
      expect(extensionOrder.filter(x => x === 'second-visit').length).toBe(2);
      expect(extensionOrder.filter(x => x === 'first-before').length).toBe(1);
      expect(extensionOrder.filter(x => x === 'second-before').length).toBe(1);
      expect(extensionOrder.filter(x => x === 'first-after').length).toBe(1);
      expect(extensionOrder.filter(x => x === 'second-after').length).toBe(1);
    });
  });
}); 