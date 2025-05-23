import { TemplateEngine } from '@js-template-engine/core';
import type { RenderOptions, TemplateNode } from '@js-template-engine/types';
import { BemExtension } from '@js-template-engine/extension-bem';
import type { BemExtension as BemTypes } from '@js-template-engine/extension-bem/src/types';

const verbose = true;

const bemExtension = new BemExtension(verbose);
const templateEngine = new TemplateEngine([bemExtension]);

const breadcrumbsTemplate: TemplateNode[] = [
  {
    tag: 'nav',
    extensions: {
      bem: {
        block: 'breadcrumbs',
      },
    },
    attributes: {
      styles: {
        padding: '1rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        '@media (max-width: 768px)': {
          padding: '0.5rem'
        }
      }
    },
    children: [
      {
        tag: 'ul',
        extensions: {
          bem: {
            element: 'list',
          },
        },
        attributes: {
          styles: {
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            gap: '1rem'
          }
        },
        children: [
          {
            tag: 'li',
            extensions: {
              bem: {
                element: 'item',
              },
            },
            attributes: {
              styles: {
                position: 'relative',
                '&:not(:last-child)::after': {
                  content: '"/"',
                  marginLeft: '1rem',
                  color: '#666'
                }
              }
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
                  styles: {
                    color: '#333',
                    textDecoration: 'none',
                    '&:hover': {
                      color: '#666'
                    }
                  }
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
            attributes: {
              styles: {
                fontWeight: 'bold'
              }
            },
            children: [
              {
                tag: 'span',
                extensions: {
                  bem: {
                    element: 'text',
                  },
                },
                attributes: {
                  styles: {
                    color: '#000'
                  }
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
    writeOutputFile: true,
    verbose,
    outputDir: 'output',
    styles: {
      outputFormat: 'scss'
    }
  } as RenderOptions & BemTypes.Options);
})(); 