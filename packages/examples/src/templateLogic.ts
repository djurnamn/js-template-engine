import { TemplateEngine } from '@js-template-engine/core';
import type { RenderOptions, ExtendedTemplate } from '@js-template-engine/types';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';

const verbose = true;

// Example demonstrating all template logic node types with React
const reactExample: ExtendedTemplate = {
  component: {
    name: 'TemplateLogicDemo',
    props: {
      items: 'Array<{ id: number; name: string }>',
      showAdvanced: 'boolean'
    }
  },
  template: [
    {
      type: 'comment',
      content: 'This demo shows all the template logic node types'
    },
    {
      type: 'fragment',
      children: [
        {
          tag: 'h1',
          children: [{ type: 'text', content: 'Template Logic Demo' }]
        },
        {
          type: 'comment',
          content: 'Conditional section'
        },
        {
          type: 'if',
          condition: 'showAdvanced',
          then: [
            {
              tag: 'section',
              attributes: { class: 'advanced-section' },
              children: [
                {
                  tag: 'h2',
                  children: [{ type: 'text', content: 'Advanced Features' }]
                },
                {
                  type: 'for',
                  items: 'items',
                  item: 'item',
                  index: 'index',
                  key: 'item.id',
                  children: [
                    {
                      tag: 'div',
                      attributes: { class: 'item-card' },
                      children: [
                        {
                          type: 'comment',
                          content: 'Item details'
                        },
                        {
                          tag: 'span',
                          children: [{ type: 'text', content: 'Item name' }]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ],
          else: [
            {
              tag: 'p',
              children: [{ type: 'text', content: 'Enable advanced mode to see more features' }]
            }
          ]
        }
      ]
    }
  ]
};

// Example with Vue
const vueExample: ExtendedTemplate = {
  component: {
    name: 'VueTemplateLogicDemo',
    props: {
      items: 'Array<{ id: number; name: string }>',
      isVisible: 'boolean'
    },
    typescript: true
  },
  template: [
    {
      type: 'comment',
      content: 'Vue component with template logic node types'
    },
    {
      type: 'fragment',
      children: [
        {
          tag: 'header',
          children: [
            {
              tag: 'h1',
              children: [{ type: 'text', content: 'Vue Demo' }]
            }
          ]
        },
        {
          type: 'if',
          condition: 'isVisible',
          then: [
            {
              tag: 'main',
              children: [
                {
                  type: 'for',
                  items: 'items',
                  item: 'item',
                  index: 'index',
                  children: [
                    {
                      tag: 'article',
                      attributes: { class: 'item' },
                      children: [
                        {
                          type: 'comment',
                          content: 'Item content here'
                        },
                        {
                          tag: 'h3',
                          children: [{ type: 'text', content: 'Item Title' }]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

// Render React example
(async () => {
  const reactEngine = new TemplateEngine([new ReactExtension()]);
  
  await reactEngine.render(reactExample, {
    name: 'template-logic-react',
    verbose,
    writeOutputFile: true,
    outputDir: 'output/react',
    fileExtension: '.tsx',
    importStatements: [
      "import React from 'react';"
    ]
  } as RenderOptions & any);

  console.log('[React Example] Generated template-logic-react.tsx');

  // Render Vue example
  const vueEngine = new TemplateEngine([new VueExtension()]);
  
  await vueEngine.render(vueExample, {
    name: 'template-logic-vue',
    verbose,
    writeOutputFile: true,
    outputDir: 'output/vue',
    fileExtension: '.vue'
  } as RenderOptions & any);

  console.log('[Vue Example] Generated template-logic-vue.vue');
  console.log('[Examples] All template logic node type examples generated successfully');
})();