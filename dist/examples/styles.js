"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TemplateEngine_1 = require("../engine/TemplateEngine");
// Create a template with nested styles
const template = [
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
const engine = new TemplateEngine_1.TemplateEngine();
// Render the template in different formats
async function renderTemplates() {
    // CSS output
    await engine.render(template, {
        name: 'card-css',
        writeOutputFile: true,
        verbose: true
    });
    // SCSS output
    await engine.render(template, {
        name: 'card-scss',
        styles: {
            outputFormat: 'scss'
        },
        writeOutputFile: true,
        verbose: true
    });
    // Inline styles output
    await engine.render(template, {
        name: 'card-inline',
        styles: {
            outputFormat: 'inline'
        },
        writeOutputFile: true,
        verbose: true
    });
}
renderTemplates().catch(console.error);
