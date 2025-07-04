import { describe, it, expect } from 'vitest';
import { RefactoredTemplateEngine } from '../src/engine/RefactoredTemplateEngine';
import type { TemplateNode } from '@js-template-engine/types';

describe('RefactoredTemplateEngine', () => {
  it('should render simple HTML template', async () => {
    const engine = new RefactoredTemplateEngine();
    
    const template: TemplateNode[] = [
      {
        tag: 'div',
        attributes: { class: 'container' },
        children: [
          { type: 'text', content: 'Hello, World!' }
        ]
      }
    ];

    const result = await engine.render(template);
    
    expect(result).toBe('<div class="container">Hello, World!</div>');
  });

  it('should handle self-closing tags', async () => {
    const engine = new RefactoredTemplateEngine();
    
    const template: TemplateNode[] = [
      {
        tag: 'img',
        attributes: { src: 'image.jpg', alt: 'Test image' },
        selfClosing: true
      }
    ];

    const result = await engine.render(template);
    
    expect(result).toBe('<img src="image.jpg" alt="Test image" />');
  });

  it('should handle nested elements', async () => {
    const engine = new RefactoredTemplateEngine();
    
    const template: TemplateNode[] = [
      {
        tag: 'div',
        attributes: { class: 'outer' },
        children: [
          {
            tag: 'span',
            attributes: { class: 'inner' },
            children: [
              { type: 'text', content: 'Nested content' }
            ]
          }
        ]
      }
    ];

    const result = await engine.render(template);
    
    expect(result).toBe('<div class="outer"><span class="inner">Nested content</span></div>');
  });

  it('should handle slots', async () => {
    const engine = new RefactoredTemplateEngine();
    
    const template: TemplateNode[] = [
      {
        tag: 'div',
        children: [
          { type: 'slot', name: 'content' }
        ]
      }
    ];

    const slotContent: TemplateNode[] = [
      { type: 'text', content: 'Slot content' }
    ];

    const result = await engine.render(template, {
      slots: { content: slotContent }
    });
    
    expect(result).toBe('<div>Slot content</div>');
  });

  it('should handle ExtendedTemplate input', async () => {
    const engine = new RefactoredTemplateEngine();
    
    const extendedTemplate = {
      template: [
        {
          tag: 'div',
          attributes: { class: 'extended' },
          children: [
            { type: 'text' as const, content: 'Extended template' }
          ]
        }
      ],
      component: {
        name: 'TestComponent'
      }
    };

    const result = await engine.render(extendedTemplate);
    
    expect(result).toBe('<div class="extended">Extended template</div>');
  });

  it('should handle recursive rendering', async () => {
    const engine = new RefactoredTemplateEngine();
    
    const template: TemplateNode[] = [
      {
        tag: 'div',
        children: [
          {
            tag: 'p',
            children: [
              { type: 'text', content: 'Level 1' },
              {
                tag: 'span',
                children: [
                  { type: 'text', content: 'Level 2' }
                ]
              }
            ]
          }
        ]
      }
    ];

    const result = await engine.render(template);
    
    expect(result).toBe('<div><p>Level 1<span>Level 2</span></p></div>');
  });
}); 