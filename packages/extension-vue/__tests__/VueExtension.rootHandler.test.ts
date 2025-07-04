import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { VueExtension } from '../src/index';
import type { ExtendedTemplate } from '@js-template-engine/types';

describe('VueExtension - rootHandler', () => {
  const extension = new VueExtension();
  const engine = new TemplateEngine([extension]);

  const vueBaseTemplate: ExtendedTemplate = {
    template: [{
      type: 'element',
      tag: 'div',
      children: [{
        type: 'text',
        content: 'Hello'
      }]
    }],
    component: {
      name: 'TestComponent',
      props: {
        title: 'string',
        handler: '(e: Event) => void'
      },
      imports: ['import { defineComponent } from "vue";'],
      extensions: {
        vue: {
          scriptContent: 'console.log("Hello")'
        }
      }
    }
  };

  it('renders a complete valid Vue component', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        typescript: true,
        props: {
          title: 'string'
        },
        imports: ['import { defineComponent } from "vue";']
      }
    };
    const result = await engine.render(template);
    expect(result.output).toMatchInlineSnapshot(`
      "<template>
      <div>Hello</div>
      </template>

      <script lang="ts">
      import { defineComponent } from "vue";

      interface TestComponentProps {
        title: string;
      }

      export default defineComponent({
        name: "TestComponent",
          props: {
          title: string
        },});
      </script>"
    `);
  });

  it('wraps content in a Vue component with script, template, and style blocks', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        typescript: true,
        props: {
          title: 'string'
        },
        imports: ['import { defineComponent } from "vue";']
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('<script lang="ts">');
    expect(result.output).toContain('import { defineComponent } from "vue"');
    expect(result.output).toContain('export default defineComponent({');
  });

  it('renders TypeScript props interface correctly', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        typescript: true,
        props: {
          title: 'string',
          handler: '(e: Event) => void'
        },
        imports: ['import { defineComponent } from "vue";']
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('interface TestComponentProps');
    expect(result.output).toContain('title: string');
    expect(result.output).toContain('handler: (e: Event) => void');
  });

  it('renders runtime props correctly', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        props: {
          title: 'string',
          handler: '(e: Event) => void'
        },
        imports: ['import { defineComponent } from "vue";']
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('props: {');
    expect(result.output).toContain('title: { type: String, required: true }');
    expect(result.output).toContain('handler: { type: Function, required: true }');
  });

  it('includes style block when styleOutput is defined', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        extensions: {
          vue: {
            styleOutput: '.test { color: red; }'
          }
        }
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('<style>\n.test { color: red; }\n</style>');
  });

  it('applies scoped attribute to style block when enabled', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        extensions: {
          vue: {
            styleOutput: '.test { color: red; }',
            scoped: true
          }
        }
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('<style scoped>');
  });

  it('applies language attribute to style block based on styles.outputFormat', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        extensions: {
          vue: {
            styleOutput: '.test { color: red; }',
            styleLang: 'scss'
          }
        }
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('<style lang="scss">');
  });

  it('resolves component name from fallback options', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        imports: ['import { defineComponent } from "vue";']
      }
    };
    const result = await engine.render(template, {
      extensions: [extension],
      name: 'CustomComponent'
    });
    expect(result.output).toContain('export default defineComponent({');
    expect(result.output).toContain('name: "CustomComponent"');
  });

  it('merges and deduplicates imports from the same module', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: [
          'import { defineComponent } from "vue";',
          'import { ref } from "vue";',
          'import { computed } from "vue";',
          'import { Button } from "./components";'
        ]
      }
    };
    const result = await engine.render(template);

    // Verify merged imports
    expect(result.output).toContain('import { computed, defineComponent, ref } from "vue";');
    expect(result.output).toContain('import { Button } from "./components";');
  });

  it('renders minimal SFC with no props or styles', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'Minimal'
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('export default defineComponent({');
    expect(result.output).toContain('name: "Minimal"');
    expect(result.output).toContain('<div>Hello</div>');
  });

  it('omits style block when styleOutput is undefined', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent'
      }
    };
    const result = await engine.render(template);
    expect(result.output).not.toContain('<style>');
  });

  it('omits style block when styleOutput is empty', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        extensions: {
          vue: {
            styleOutput: ''
          }
        }
      }
    };
    const result = await engine.render(template);
    expect(result.output).not.toContain('<style>');
  });

  it('uses composition API with setup script when enabled', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        typescript: true,
        extensions: {
          vue: {
            compositionAPI: true,
            setupScript: true
          }
        }
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('<script setup lang="ts">');
    expect(result.output).not.toContain('export default defineComponent');
  });

  it('uses composition API without setup script when specified', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        typescript: true,
        extensions: {
          vue: {
            compositionAPI: true,
            setupScript: false
          }
        }
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('<script lang="ts">');
    expect(result.output).toContain('export default defineComponent({');
    expect(result.output).toContain('setup() {');
  });

  it('uses options API by default', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        typescript: true
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('<script lang="ts">');
    expect(result.output).toContain('export default defineComponent({');
    expect(result.output).not.toContain('setup()');
  });

  it('sanitizes component name and attributes', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'my-component',
        attributes: {
          'data-id': 'some-id'
        },
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent'
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('name: "TestComponent"');
    expect(result.output).toContain('<my-component');
    expect(result.output).toContain('data-id="some-id"');
  });
}); 