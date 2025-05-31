import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { VueExtension } from '../src/index';
import type { ExtendedTemplate } from '@js-template-engine/types';

describe('VueExtension - rootHandler', () => {
  const extension = new VueExtension();

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

  it('renders a complete valid Vue component snapshot', () => {
    const output = extension.rootHandler('<div>Hello</div>', {
      componentName: 'TestComponent',
      scriptContent: 'console.log("Hello")',
      scoped: true,
      styleLang: 'scss',
      setup: true,
      composition: true
    }, {
      component: {
        typescript: true,
        props: {
          title: 'string',
          handler: '(e: Event) => void'
        },
        imports: [
          'import { ref, computed, watch, onMounted } from "vue"',
          'import { Button } from "./components"'
        ]
      },
      styleOutput: '.test { color: red; }',
      framework: 'vue'
    });

    expect(output).toMatchInlineSnapshot(`
      "<template>
      <div>Hello</div>
      </template>

      <script setup lang=\"ts\">
      import { computed, defineComponent, onMounted, ref, watch } from \"vue\";
      import { Button } from \"./components\";

      interface TestComponentProps {
        title: string;
        handler: (e: Event) => void;
      }

      defineProps<TestComponentProps>();
      console.log(\"Hello\")
      </script>

      <style scoped lang=\"scss\">
      .test { color: red; }
      </style>"
    `);
  });

  it('wraps content in a Vue component with script, template, and style blocks', async () => {
    const engine = new TemplateEngine([extension]);
    const output = await engine.render(vueBaseTemplate, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('<script lang="ts">');
    expect(output).toContain('import { defineComponent } from "vue"');
    expect(output).toContain('export default defineComponent({');
    expect(output).toContain('<template>');
    expect(output).toContain('<div>Hello</div>');
    expect(output).toContain('</template>');
  });

  it('renders TypeScript props interface correctly', async () => {
    const template: ExtendedTemplate = {
      ...vueBaseTemplate,
      component: {
        ...vueBaseTemplate.component,
        typescript: true
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('interface TestComponentProps');
    expect(output).toContain('title: string');
    expect(output).toContain('handler: (e: Event) => void');
  });

  it('renders runtime props correctly', async () => {
    const template: ExtendedTemplate = {
      ...vueBaseTemplate,
      component: {
        ...vueBaseTemplate.component,
        typescript: false
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('props: {');
    expect(output).toContain('title: { type: String, required: true }');
    expect(output).toContain('handler: { type: Function, required: true }');
  });

  it('includes style block when styleOutput is defined', async () => {
    const template: ExtendedTemplate = {
      ...vueBaseTemplate,
      component: {
        ...vueBaseTemplate.component,
        extensions: {
          vue: {
            styleOutput: '.test { color: red; }'
          }
        }
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('<style>\n.test { color: red; }\n</style>');
  });

  it('applies scoped attribute to style block when enabled', async () => {
    const template: ExtendedTemplate = {
      ...vueBaseTemplate,
      component: {
        ...vueBaseTemplate.component,
        extensions: {
          vue: {
            styleOutput: '.test { color: red; }',
            scoped: true
          }
        }
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('<style scoped>');
  });

  it('applies language attribute to style block when specified', async () => {
    const template: ExtendedTemplate = {
      ...vueBaseTemplate,
      component: {
        ...vueBaseTemplate.component,
        extensions: {
          vue: {
            styleOutput: '.test { color: red; }',
            styleLang: 'scss'
          }
        }
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('<style lang="scss">');
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
        props: {
          title: 'string'
        },
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
      name: 'CustomComponent'
    });

    expect(output).toContain('export default defineComponent({');
    expect(output).toContain('name: "CustomComponent"');
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
        props: {
          title: 'string'
        },
        imports: [
          'import { defineComponent } from "vue";',
          'import { ref } from "vue";',
          'import { computed } from "vue";',
          'import { Button } from "./components";'
        ]
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    // Verify merged imports
    expect(output).toContain('import { computed, defineComponent, ref } from "vue";');
    expect(output).toContain('import { Button } from "./components";');
    
    // Verify no duplicate imports
    expect(output).not.toContain('import { ref } from "vue";');
    expect(output).not.toContain('import { computed } from "vue";');
    expect(output).not.toContain('import { defineComponent } from "vue";');
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

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('export default defineComponent({');
    expect(output).toContain('name: "Minimal"');
    expect(output).toContain('<div>Hello</div>');
    expect(output).not.toContain('props');
    expect(output).not.toContain('import');
  });

  it('omits style block when styleOutput is undefined', async () => {
    const engine = new TemplateEngine([extension]);
    const output = await engine.render(vueBaseTemplate, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).not.toContain('<style>');
    expect(output).not.toContain('</style>');
  });

  it('omits style block when styleOutput is empty', async () => {
    const template: ExtendedTemplate = {
      ...vueBaseTemplate,
      component: {
        ...vueBaseTemplate.component,
        extensions: {
          vue: {
            styleOutput: ''
          }
        }
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).not.toContain('<style>');
    expect(output).not.toContain('</style>');
  });

  it('uses composition API with setup script when enabled', async () => {
    const template: ExtendedTemplate = {
      ...vueBaseTemplate,
      component: {
        ...vueBaseTemplate.component,
        extensions: {
          vue: {
            composition: true,
            useSetup: true
          }
        }
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('<script setup lang="ts">');
    expect(output).not.toContain('export default defineComponent');
  });

  it('uses composition API without setup script when specified', async () => {
    const template: ExtendedTemplate = {
      ...vueBaseTemplate,
      component: {
        ...vueBaseTemplate.component,
        extensions: {
          vue: {
            composition: true,
            useSetup: false
          }
        }
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('<script lang="ts">');
    expect(output).toContain('export default defineComponent({');
    expect(output).toContain('setup() {');
  });

  it('uses options API by default', async () => {
    const template: ExtendedTemplate = {
      ...vueBaseTemplate,
      component: {
        ...vueBaseTemplate.component,
        extensions: {
          vue: {
            composition: false
          }
        }
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('<script lang="ts">');
    expect(output).toContain('export default defineComponent({');
    expect(output).not.toContain('setup()');
  });

  it('sanitizes component name and attributes', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'my-component',
        attributes: {
          'data-id': 'some@id!',
          class: 'container@123'
        },
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'Test@Component!',
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('name: "TestComponent"');
    expect(output).toContain('<my-component');
    expect(output).toContain('data-id="some-id"');
    expect(output).toContain('class="container-123"');
  });
}); 