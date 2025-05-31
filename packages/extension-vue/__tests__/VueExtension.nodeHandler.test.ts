import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { VueExtension } from '../src/index';
import type { ExtendedTemplate } from '@js-template-engine/types';

describe('VueExtension - nodeHandler', () => {
  const extension = new VueExtension();

  it('preserves standard HTML attributes', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          class: 'container',
          for: 'input-1'
        },
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('class="container"');
    expect(output).toContain('for="input-1"');
  });

  it('applies expression attributes as dynamic bindings', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          class: 'container'
        },
        extensions: {
          vue: {
            bindAttributes: {
              'v-bind:class': 'dynamicClass',
              ':style': 'dynamicStyle'
            }
          }
        },
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain(':class="dynamicClass"');
    expect(output).toContain(':style="dynamicStyle"');
  });

  it('combines static and dynamic attributes correctly', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          id: 'main',
          class: 'container'
        },
        extensions: {
          vue: {
            bindAttributes: {
              ':class': 'computedClass',
              ':style': 'dynamicStyle'
            }
          }
        },
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('id="main"');
    expect(output).toContain('class="container"');
    expect(output).toContain(':class="computedClass"');
    expect(output).toContain(':style="dynamicStyle"');
  });

  it('applies conditional and list rendering directives', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        extensions: {
          vue: {
            directives: {
              'v-if': 'isVisible',
              'v-for': '(item, index) in items'
            }
          }
        },
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('v-if="isVisible"');
    expect(output).toContain('v-for="(item, index) in items"');
  });

  it('transforms event handlers to v-on directives', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'button',
        extensions: {
          vue: {
            eventHandlers: {
              'click': 'handleClick',
              'input': 'handleInput'
            }
          }
        },
        children: [{
          type: 'text',
          content: 'Click me'
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('@click="handleClick"');
    expect(output).toContain('@input="handleInput"');
  });

  it('renders named slots with proper attributes', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'element',
          tag: 'slot',
          attributes: {
            name: 'header'
          }
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('<slot name="header"></slot>');
  });

  it('renders scoped slots with bound props', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'element',
          tag: 'slot',
          attributes: {
            name: 'item'
          },
          extensions: {
            vue: {
              slotProps: {
                item: 'item',
                index: 'index'
              }
            }
          }
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('<slot name="item" :item="item" :index="index"></slot>');
  });

  it('merges static and dynamic class/style bindings', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          class: 'base-class'
        },
        extensions: {
          vue: {
            bindAttributes: {
              ':class': '{ active: isActive }',
              ':style': '{ color: textColor }'
            }
          }
        },
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('class="base-class" :class="{ active: isActive }"');
    expect(output).toContain(':style="{ color: textColor }"');
  });

  it('applies transformations to nested elements', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          class: 'parent'
        },
        children: [{
          type: 'element',
          tag: 'label',
          attributes: {
            for: 'input-1',
            class: 'child'
          },
          extensions: {
            vue: {
              directives: {
                'v-if': 'showLabel'
              }
            }
          },
          children: [{
            type: 'text',
            content: 'Label'
          }]
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('class="parent"');
    expect(output).toContain('for="input-1"');
    expect(output).toContain('class="child"');
    expect(output).toContain('v-if="showLabel"');
  });

  it('sanitizes attribute values for security', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          'data-id': 'some@id!',
          class: 'container@123',
          onclick: 'alert("xss")'
        },
        extensions: {
          vue: {
            bindAttributes: {
              ':class': 'computedClass',
              ':style': 'dynamicStyle'
            }
          }
        },
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import { defineComponent } from "vue";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const output = await engine.render(template, {
      fileExtension: '.vue',
      extensions: [extension],
    });

    expect(output).toContain('data-id="some-id"');
    expect(output).toContain('class="container-123"');
    expect(output).not.toContain('onclick="alert("xss")"');
    expect(output).toContain(':class="computedClass"');
    expect(output).toContain(':style="dynamicStyle"');
  });
}); 