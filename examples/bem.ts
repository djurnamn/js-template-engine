import { TemplateEngine } from '../src/engine/TemplateEngine';
import { BemExtension } from '../src/extensions/bem';
import { ExtendedTemplateNode, BemExtension as BemTypes } from '../src/types/extensions';
import { TemplateOptions } from '../src/types';

const verbose = true;

const templateEngine = new TemplateEngine();
const bemExtension = new BemExtension(verbose);

const breadcrumbsTemplate: ExtendedTemplateNode[] = [
  {
    tag: 'nav',
    extensions: {
      bem: {
        block: 'breadcrumbs',
      },
    },
    children: [
      {
        tag: 'ul',
        extensions: {
          bem: {
            element: 'list',
          },
        },
        children: [
          {
            tag: 'li',
            extensions: {
              bem: {
                element: 'item',
              },
            },
            children: [
              {
                tag: 'a',
                extensions: {
                  bem: {
                    element: 'text',
                  },
                },
                attributes: {
                  href: '/',
                },
                children: [
                  {
                    type: 'text',
                    content: 'Home',
                  },
                ],
              },
            ],
          },
          {
            tag: 'li',
            extensions: {
              bem: {
                element: 'item',
                modifier: 'current',
              },
            },
            children: [
              {
                tag: 'span',
                extensions: {
                  bem: {
                    element: 'text',
                  },
                },
                children: [
                  {
                    type: 'text',
                    content: 'About',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

// Render
(async () => {
  await templateEngine.render(breadcrumbsTemplate, {
    name: 'breadcrumbs',
    extensions: [bemExtension],
    writeOutputFile: true,
    verbose,
  } as TemplateOptions & BemTypes.Options);
})(); 