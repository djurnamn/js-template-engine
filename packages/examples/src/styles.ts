import { TemplateEngine } from '@js-template-engine/core';
import type { TemplateNode } from '@js-template-engine/types';

// Create a template with nested styles
const template: TemplateNode[] = [
  {
    tag: 'div',
    attributes: {
      class: 'card',
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
        tag: 'h2',
        attributes: {
          class: 'card__title',
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
  }
];

// Initialize the template engine
const engine = new TemplateEngine();

// Render the template in different formats
async function renderTemplates() {
  // CSS output
  await engine.render(template, {
    name: 'card-css',
    writeOutputFile: true,
    verbose: true,
    outputDir: 'output'
  });

  // SCSS output
  await engine.render(template, {
    name: 'card-scss',
    styles: {
      outputFormat: 'scss'
    },
    writeOutputFile: true,
    verbose: true,
    outputDir: 'output'
  });

  // Inline styles output
  await engine.render(template, {
    name: 'card-inline',
    styles: {
      outputFormat: 'inline'
    },
    writeOutputFile: true,
    verbose: true,
    outputDir: 'output'
  });
}

renderTemplates().catch(console.error); 