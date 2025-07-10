import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { VueExtension } from '../src';
import type { ExtendedTemplate } from '@js-template-engine/types';

describe('VueExtension - nodeHandler', () => {
  const extension = new VueExtension();
  const engine = new TemplateEngine([extension]);

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
        name: 'TestComponent'
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('class="container"');
    expect(result.output).toContain('for="input-1"');
  });

  it('applies expression attributes as dynamic bindings', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          class: 'base'
        },
        extensions: {
          vue: {
            expressionAttributes: {
              ':class': 'dynamicClass',
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
        name: 'TestComponent'
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain(':class="dynamicClass"');
    expect(result.output).toContain(':style="dynamicStyle"');
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
            expressionAttributes: {
              ':class': 'computedClass'
            }
          }
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
    expect(result.output).toContain('id="main"');
    expect(result.output).toContain('class="container"');
    expect(result.output).toContain(':class="computedClass"');
  });

  it('applies conditional and list rendering directives', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        extensions: {
          vue: {
            expressionAttributes: {
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
        name: 'TestComponent'
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('v-if="isVisible"');
    expect(result.output).toContain('v-for="(item, index) in items"');
  });

  it('transforms event handlers to v-on directives', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'button',
        extensions: {
          vue: {
            expressionAttributes: {
              '@click': 'handleClick',
              '@input': 'handleInput'
            }
          }
        },
        children: [{
          type: 'text',
          content: 'Click me'
        }]
      }],
      component: {
        name: 'TestComponent'
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('@click="handleClick"');
    expect(result.output).toContain('@input="handleInput"');
  });

  it('renders named slots with proper attributes', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'slot',
        name: 'header'
      }],
      component: {
        name: 'TestComponent'
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('<slot name="header"></slot>');
  });

  it('renders scoped slots with bound props', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'slot',
        name: 'item',
        extensions: {
          vue: {
            expressionAttributes: {
              ':item': 'item',
              ':index': 'index'
            }
          }
        }
      }],
      component: {
        name: 'TestComponent'
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('<slot name="item" :item="item" :index="index"></slot>');
  });

  it('renders slots with fallback content', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'slot',
        name: 'header',
        fallback: [
          { type: 'text', content: 'Default Header' }
        ]
      }],
      component: {
        name: 'TestComponent'
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('<slot name="header">Default Header</slot>');
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
            expressionAttributes: {
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
        name: 'TestComponent'
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('class="base-class" :class="{ active: isActive }"');
    expect(result.output).toContain(':style="{ color: textColor }"');
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
          children: [{
            type: 'text',
            content: 'Label'
          }]
        }]
      }],
      component: {
        name: 'TestComponent'
      }
    };
    const result = await engine.render(template);
    expect(result.output).toContain('class="parent"');
    expect(result.output).toContain('for="input-1"');
    expect(result.output).toContain('class="child"');
  });

  it('sanitizes attribute values for security', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          'data-id': 'some-id',
          class: 'container-123'
        },
        extensions: {
          vue: {
            expressionAttributes: {
              onclick: 'alert(\'xss\')'
            }
          }
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
    expect(result.output).toContain('data-id="some-id"');
    expect(result.output).toContain('class="container-123"');
    expect(result.output).toContain(':onclick="alert(\'xss\')"');
    expect(result.output).not.toMatch(/[^:]onclick="/);
  });
}); 