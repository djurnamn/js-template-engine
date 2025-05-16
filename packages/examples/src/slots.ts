import { TemplateEngine } from '@js-template-engine/core';
import type { RenderOptions, TemplateNode } from '@js-template-engine/types';

const verbose = true;

const templateEngine = new TemplateEngine();

const slotsTemplate: TemplateNode[] = [
  {
    tag: 'div',
    attributes: {
      class: 'card',
    },
    children: [
      {
        tag: 'div',
        attributes: {
          class: 'card-header',
        },
        children: [
          {
            type: 'slot',
            name: 'header',
          },
        ],
      },
      {
        tag: 'div',
        attributes: {
          class: 'card-content',
        },
        children: [
          {
            type: 'slot',
            name: 'content',
          },
        ],
      },
      {
        tag: 'div',
        attributes: {
          class: 'card-footer',
        },
        children: [
          {
            type: 'slot',
            name: 'footer',
          },
        ],
      },
    ],
  },
];

// Render
(async () => {
  await templateEngine.render(slotsTemplate, {
    name: 'slots',
    writeOutputFile: true,
    verbose,
    outputDir: 'output',
    styles: {
      outputFormat: 'scss'
    }
  } as RenderOptions);
})(); 