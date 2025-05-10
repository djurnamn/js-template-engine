import { TemplateEngine } from '../src/engine/TemplateEngine';
import { ExtendedTemplateNode } from '../src/types/extensions';
import { TemplateOptions } from '../src/types';

const verbose = true;

const templateEngine = new TemplateEngine();

type CardSlots = Record<string, ExtendedTemplateNode[]> & {
  header?: ExtendedTemplateNode[];
  content: ExtendedTemplateNode[];
  footer?: ExtendedTemplateNode[];
};

const cardTemplate: ExtendedTemplateNode[] = [
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

const slots: CardSlots = {
  header: [
    {
      tag: 'h2',
      children: [
        {
          type: 'text',
          content: 'Card Title',
        },
      ],
    },
  ],
  content: [
    {
      tag: 'p',
      children: [
        {
          type: 'text',
          content: 'This is the main content of the card.',
        },
      ],
    },
  ],
  footer: [
    {
      tag: 'button',
      children: [
        {
          type: 'text',
          content: 'Read More',
        },
      ],
    },
  ],
};

// Render
(async () => {
  await templateEngine.render(cardTemplate, {
    name: 'card',
    slots,
    writeOutputFile: true,
    verbose,
  } as TemplateOptions);
})(); 