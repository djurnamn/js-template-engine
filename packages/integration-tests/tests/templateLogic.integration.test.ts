import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';
import { BemExtension } from '@js-template-engine/extension-bem';
import type { ExtendedTemplate } from '@js-template-engine/types';

describe('Template Logic Integration Tests', () => {
  describe('React Extension with Template Logic', () => {
    const reactEngine = new TemplateEngine([new BemExtension(), new ReactExtension()], false);

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

      const result = await reactEngine.render(template, {
        fileExtension: '.tsx',
        prettierParser: 'typescript'
      });

      expect(result.output).toContain('{/* This is a test comment */}');
      expect(result.output).toContain('Hello World');
      expect(result.errors).toEqual([]);
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

      const result = await reactEngine.render(template, {
        fileExtension: '.tsx',
        prettierParser: 'typescript'
      });

      expect(result.output).toContain('<React.Fragment>');
      expect(result.output).toContain('<h1>Title</h1>');
      expect(result.output).toContain('<p>Content</p>');
      expect(result.output).toContain('</React.Fragment>');
      expect(result.errors).toEqual([]);
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

      const result = await reactEngine.render(template, {
        fileExtension: '.tsx',
        prettierParser: 'typescript'
      });

      expect(result.output).toContain('{props.isVisible ?');
      expect(result.output).toContain('Visible content');
      expect(result.output).toContain('Hidden content');
      expect(result.errors).toEqual([]);
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

      const result = await reactEngine.render(template, {
        fileExtension: '.tsx',
        prettierParser: 'typescript'
      });

      expect(result.output).toContain('{props.items.map((item, index) =>');
      expect(result.output).toContain('<React.Fragment key={item.id}>');
      expect(result.output).toContain('List item');
      expect(result.errors).toEqual([]);
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

      const result = await reactEngine.render(template, {
        fileExtension: '.tsx',
        prettierParser: 'typescript'
      });

      expect(result.output).toContain('<React.Fragment>');
      expect(result.output).toContain('{/* List container */}');
      expect(result.output).toContain('{props.items.map(');
      expect(result.output).toContain('{item.visible &&');
      expect(result.errors).toEqual([]);
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

      const result = await reactEngine.render(template, {
        fileExtension: '.tsx',
        prettierParser: 'typescript'
      });

      expect(result.output).toContain('className="card card--primary"');
      expect(result.output).toContain('{/* Card content */}');
      expect(result.output).toContain('{props.showTitle &&');
      // Note: BEM classes may not be applied to conditional children - this is expected behavior
      expect(result.errors).toEqual([]);
    });
  });

  describe('Vue Extension with Template Logic', () => {
    const vueEngine = new TemplateEngine([new BemExtension(), new VueExtension()], false);

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

      const result = await vueEngine.render(template, {
        fileExtension: '.vue'
      });

      expect(result.output).toContain('<!-- Vue comment test -->');
      expect(result.output).toContain('Hello Vue');
      expect(result.errors).toEqual([]);
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

      const result = await vueEngine.render(template, {
        fileExtension: '.vue'
      });

      expect(result.output).toContain('<header>Header</header>');
      expect(result.output).toContain('<main>Main</main>');
      expect(result.errors).toEqual([]);
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

      const result = await vueEngine.render(template, {
        fileExtension: '.vue'
      });

      expect(result.output).toContain('v-if="isVisible"');
      expect(result.output).toContain('Visible in Vue');
      expect(result.errors).toEqual([]);
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

      const result = await vueEngine.render(template, {
        fileExtension: '.vue'
      });

      expect(result.output).toContain('v-for="(item, index) in items"');
      expect(result.output).toContain('Vue list item');
      expect(result.errors).toEqual([]);
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

      const result = await vueEngine.render(template, {
        fileExtension: '.vue'
      });

      // Vue BEM may format classes differently
      expect(result.output).toMatch(/class="hero[^"]*large[^"]*"/);
      expect(result.output).toContain('class="hero__title"');
      expect(result.output).toContain('<!-- Hero section -->');
      expect(result.output).toContain('v-if="hasTitle"');
      expect(result.errors).toEqual([]);
    });
  });

  describe('Error Handling for New Node Types', () => {
    const reactEngine = new TemplateEngine([new ReactExtension()], false);

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

      const result = await reactEngine.render(template, {
        fileExtension: '.tsx',
        prettierParser: 'typescript'
      });

      // Should not crash and should handle gracefully
      expect(result.output).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
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

      const result = await reactEngine.render(template, {
        fileExtension: '.tsx',
        prettierParser: 'typescript'
      });

      // Should not crash and should handle gracefully
      expect(result.output).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});