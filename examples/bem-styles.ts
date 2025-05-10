import { TemplateEngine } from '../src/engine/TemplateEngine';
import { TemplateNode } from '../src/types';
import { BemExtension } from '../src/extensions/bem';
import { BemExtension as BemTypes } from '../src/types/extensions';

// Create a template with BEM structure and styles
const template: TemplateNode[] = [
  {
    tag: 'div',
    extensions: {
      bem: {
        block: 'card',
      },
    },
    attributes: {
      styles: {
        padding: '20px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        '@media max-width: 768px': {
          padding: '10px'
        }
      }
    },
    children: [
      {
        tag: 'div',
        extensions: {
          bem: {
            element: 'header',
          },
        },
        attributes: {
          styles: {
            marginBottom: '16px',
            borderBottom: '1px solid #eee'
          }
        },
        children: [
          {
            tag: 'h2',
            extensions: {
              bem: {
                element: 'title',
              },
            },
            attributes: {
              styles: {
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#333',
                ':hover': {
                  color: '#666'
                }
              }
            },
            children: [
              {
                type: 'text',
                content: 'Card Title'
              }
            ]
          }
        ]
      },
      {
        tag: 'div',
        extensions: {
          bem: {
            element: 'content',
          },
        },
        attributes: {
          styles: {
            color: '#666',
            lineHeight: '1.5'
          }
        },
        children: [
          {
            tag: 'p',
            extensions: {
              bem: {
                element: 'text',
              },
            },
            attributes: {
              styles: {
                marginBottom: '12px',
                ':last-child': {
                  marginBottom: '0'
                }
              }
            },
            children: [
              {
                type: 'text',
                content: 'This is a card component using BEM methodology with integrated styles.'
              }
            ]
          }
        ]
      }
    ]
  }
];

// Initialize the template engine and BEM extension
const engine = new TemplateEngine();
const bemExtension = new BemExtension(true);

// Render the template in different formats
async function renderTemplates() {
  // SCSS output with BEM
  await engine.render(template, {
    name: 'bem-card-scss',
    styles: {
      outputFormat: 'scss'
    },
    writeOutputFile: true,
    verbose: true,
    extensions: [bemExtension]
  } as BemTypes.Options);
}

renderTemplates().catch(console.error); 