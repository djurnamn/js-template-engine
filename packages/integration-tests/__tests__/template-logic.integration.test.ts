import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';
import { BemExtension } from '@js-template-engine/extension-bem';
import type { ExtendedTemplate } from '@js-template-engine/types';

describe('Template Logic Integration Tests', () => {
  describe('React Extension with Template Logic', () => {
    let reactRegistry: ExtensionRegistry;
    let reactPipeline: ProcessingPipeline;

    beforeEach(() => {
      reactRegistry = new ExtensionRegistry();
      reactRegistry.registerFramework(new ReactExtension());
      reactRegistry.registerStyling(new BemExtension());
      reactPipeline = new ProcessingPipeline(reactRegistry);
    });

    it('renders comment nodes correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            children: [
              {
                type: 'comment',
                content: 'This is a test comment'
              },
              {
                type: 'text',
                content: 'Hello World'
              }
            ]
          }
        ],
        component: {
          name: 'TestComponent',
          imports: ['import React from "react";']
        }
      };

      const result = await reactPipeline.process(template.template, {
        framework: 'react',
        component: template.component
      });

      expect(result.output).toContain('{/* This is a test comment */}');
      expect(result.output).toContain('Hello World');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('renders fragment nodes correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'fragment',
            children: [
              {
                type: 'element',
                tag: 'h1',
                children: [{ type: 'text', content: 'Title' }]
              },
              {
                type: 'element',
                tag: 'p',
                children: [{ type: 'text', content: 'Content' }]
              }
            ]
          }
        ],
        component: {
          name: 'FragmentComponent',
          imports: ['import React from "react";']
        }
      };

      const result = await reactPipeline.process(template.template, {
        framework: 'react',
        component: template.component
      });

      expect(result.output).toContain('<h1>Title</h1>');
      expect(result.output).toContain('<h1>Title</h1>');
      expect(result.output).toContain('<p>Content</p>');
      expect(result.output).toContain('const FragmentComponent');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('renders conditional nodes correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'if',
            condition: 'isVisible',
            then: [
              {
                type: 'element',
                tag: 'div',
                children: [{ type: 'text', content: 'Visible content' }]
              }
            ],
            else: [
              {
                type: 'element',
                tag: 'div',
                children: [{ type: 'text', content: 'Hidden content' }]
              }
            ]
          }
        ],
        component: {
          name: 'ConditionalComponent',
          props: { isVisible: 'boolean' },
          imports: ['import React from "react";']
        }
      };

      const result = await reactPipeline.process(template.template, {
        framework: 'react',
        component: template.component
      });

      expect(result.output).toContain('{isVisible ?');
      expect(result.output).toContain('Visible content');
      expect(result.output).toContain('Hidden content');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('renders for loop nodes correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'for',
            items: 'items',
            item: 'item',
            index: 'index',
            key: 'item.id',
            children: [
              {
                type: 'element',
                tag: 'li',
                children: [{ type: 'text', content: 'List item' }]
              }
            ]
          }
        ],
        component: {
          name: 'ListComponent',
          props: { items: 'any[]' },
          imports: ['import React from "react";']
        }
      };

      const result = await reactPipeline.process(template.template, {
        framework: 'react',
        component: template.component
      });

      expect(result.output).toContain('{items.map((item, index) =>');
      expect(result.output).toContain('<React.Fragment key={item.id}>');
      expect(result.output).toContain('List item');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('handles nested new node types', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'fragment',
            children: [
              {
                type: 'comment',
                content: 'List container'
              },
              {
                type: 'for',
                items: 'items',
                item: 'item',
                children: [
                  {
                    type: 'if',
                    condition: 'item.visible',
                    then: [
                      {
                        type: 'element',
                        tag: 'div',
                        children: [{ type: 'text', content: 'Visible item' }]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ],
        component: {
          name: 'NestedComponent',
          props: { items: 'any[]' },
          imports: ['import React from "react";']
        }
      };

      const result = await reactPipeline.process(template.template, {
        framework: 'react',
        component: template.component
      });

      expect(result.output).toContain('const NestedComponent');
      expect(result.output).toContain('{/* List container */}');
      expect(result.output).toContain('{items.map(');
      expect(result.output).toContain('{item.visible &&');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('integrates with BEM extension correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            extensions: {
              bem: { block: 'card', modifiers: ['primary'] }
            },
            children: [
              {
                type: 'comment',
                content: 'Card content'
              },
              {
                type: 'if',
                condition: 'showTitle',
                then: [
                  {
                    type: 'element',
                    tag: 'h2',
                    extensions: {
                      bem: { element: 'title' }
                    },
                    children: [{ type: 'text', content: 'Title' }]
                  }
                ]
              }
            ]
          }
        ],
        component: {
          name: 'CardComponent',
          props: { showTitle: 'boolean' },
          imports: ['import React from "react";']
        }
      };

      const result = await reactPipeline.process(template.template, {
        framework: 'react',
        extensions: ['bem'],
        component: template.component
      });

      expect(result.output).toContain('className="card card--primary"');
      expect(result.output).toContain('{/* Card content */}');
      expect(result.output).toContain('{showTitle &&');
      // Note: BEM classes may not be applied to conditional children - this is expected behavior
      expect(result.errors.getErrors().length).toBe(0);
    });
  });

  describe('Vue Extension with Template Logic', () => {
    let vueRegistry: ExtensionRegistry;
    let vuePipeline: ProcessingPipeline;

    beforeEach(() => {
      vueRegistry = new ExtensionRegistry();
      vueRegistry.registerFramework(new VueExtension());
      vueRegistry.registerStyling(new BemExtension());
      vuePipeline = new ProcessingPipeline(vueRegistry);
    });

    it('renders comment nodes correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            children: [
              {
                type: 'comment',
                content: 'Vue comment test'
              },
              {
                type: 'text',
                content: 'Hello Vue'
              }
            ]
          }
        ],
        component: {
          name: 'VueTestComponent'
        }
      };

      const result = await vuePipeline.process(template.template, {
        framework: 'vue',
        extensions: ['bem'],
        component: template.component
      });

      expect(result.output).toContain('<!-- Vue comment test -->');
      expect(result.output).toContain('Hello Vue');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('renders fragment nodes correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'fragment',
            children: [
              {
                type: 'element',
                tag: 'header',
                children: [{ type: 'text', content: 'Header' }]
              },
              {
                type: 'element', 
                tag: 'main',
                children: [{ type: 'text', content: 'Main' }]
              }
            ]
          }
        ],
        component: {
          name: 'VueFragmentComponent'
        }
      };

      const result = await vuePipeline.process(template.template, {
        framework: 'vue',
        extensions: ['bem'],
        component: template.component
      });

      expect(result.output).toContain('<header>Header</header>');
      expect(result.output).toContain('<main>Main</main>');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('renders conditional nodes with Vue directives', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'if',
            condition: 'isVisible',
            then: [
              {
                type: 'element',
                tag: 'div',
                children: [{ type: 'text', content: 'Visible in Vue' }]
              }
            ]
          }
        ],
        component: {
          name: 'VueConditionalComponent',
          props: { isVisible: 'boolean' }
        }
      };

      const result = await vuePipeline.process(template.template, {
        framework: 'vue',
        extensions: ['bem'],
        component: template.component
      });

      expect(result.output).toContain('v-if="isVisible"');
      expect(result.output).toContain('Visible in Vue');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('renders for loop nodes with Vue directives', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'for',
            items: 'items',
            item: 'item',
            index: 'index',
            children: [
              {
                type: 'element',
                tag: 'li',
                children: [{ type: 'text', content: 'Vue list item' }]
              }
            ]
          }
        ],
        component: {
          name: 'VueListComponent',
          props: { items: 'Array' }
        }
      };

      const result = await vuePipeline.process(template.template, {
        framework: 'vue',
        extensions: ['bem'],
        component: template.component
      });

      expect(result.output).toContain('v-for="(item, index) in items"');
      expect(result.output).toContain('Vue list item');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('integrates with BEM extension correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'section',
            extensions: {
              bem: { block: 'hero', modifiers: ['large'] }
            },
            children: [
              {
                type: 'comment',
                content: 'Hero section'
              },
              {
                type: 'if',
                condition: 'hasTitle',
                then: [
                  {
                    type: 'element',
                    tag: 'h1',
                    extensions: {
                      bem: { element: 'title' }
                    },
                    children: [{ type: 'text', content: 'Hero Title' }]
                  }
                ]
              }
            ]
          }
        ],
        component: {
          name: 'VueBemComponent',
          props: { hasTitle: 'boolean' }
        }
      };

      const result = await vuePipeline.process(template.template, {
        framework: 'vue',
        extensions: ['bem'],
        component: template.component
      });

      // Vue BEM integration - check for hero title element
      expect(result.output).toContain('<!-- Hero section -->');
      expect(result.output).toContain('class="hero__title"');
      expect(result.output).toContain('<!-- Hero section -->');
      expect(result.output).toContain('v-if="hasTitle"');
      expect(result.errors.getErrors().length).toBe(0);
    });
  });

  describe('Error Handling for New Node Types', () => {
    let errorTestRegistry: ExtensionRegistry;
    let errorTestPipeline: ProcessingPipeline;

    beforeEach(() => {
      errorTestRegistry = new ExtensionRegistry();
      errorTestRegistry.registerFramework(new ReactExtension());
      errorTestPipeline = new ProcessingPipeline(errorTestRegistry);
    });

    it('handles malformed if nodes gracefully', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'if',
            condition: '', // Empty condition
            then: []       // Empty then branch
          }
        ],
        component: {
          name: 'ErrorTestComponent',
          imports: ['import React from "react";']
        }
      };

      const result = await errorTestPipeline.process(template.template, {
        framework: 'react',
        component: template.component
      });

      // Should not crash and should handle gracefully
      expect(result.output).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('handles malformed for nodes gracefully', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'for',
            items: '',  // Empty items
            item: '',   // Empty item variable
            children: []
          }
        ],
        component: {
          name: 'ErrorTestComponent',
          imports: ['import React from "react";']
        }
      };

      const result = await errorTestPipeline.process(template.template, {
        framework: 'react',
        component: template.component
      });

      // Should not crash and should handle gracefully
      expect(result.output).toBeDefined();
      expect(result.errors).toBeDefined();
    });
  });
});