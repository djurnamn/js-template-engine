import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../src/engine/TemplateEngine';
import type { TemplateNode } from '@js-template-engine/types';
import { TemplateEngineError, ValidationError, ExtensionError, FileOutputError } from '../src/engine/errors';

describe('RefactoredTemplateEngine', () => {
  it('should render simple HTML template', async () => {
    const engine = new TemplateEngine();
    
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
    
    expect(result.output).toBe('<div class="container">Hello, World!</div>');
    expect(result.errors).toEqual([]);
  });

  it('should handle self-closing tags', async () => {
    const engine = new TemplateEngine();
    
    const template: TemplateNode[] = [
      {
        tag: 'img',
        attributes: { src: 'image.jpg', alt: 'Test image' },
        selfClosing: true
      }
    ];

    const result = await engine.render(template);
    
    expect(result.output).toBe('<img src="image.jpg" alt="Test image" />');
    expect(result.errors).toEqual([]);
  });

  it('should handle nested elements', async () => {
    const engine = new TemplateEngine();
    
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
    
    expect(result.output).toBe('<div class="outer"><span class="inner">Nested content</span></div>');
    expect(result.errors).toEqual([]);
  });

  it('should handle slots', async () => {
    const engine = new TemplateEngine();
    
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
    
    expect(result.output).toBe('<div>Slot content</div>');
    expect(result.errors).toEqual([]);
  });

  it('should handle ExtendedTemplate input', async () => {
    const engine = new TemplateEngine();
    
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
    
    expect(result.output).toBe('<div class="extended">Extended template</div>');
    expect(result.errors).toEqual([]);
  });

  it('should handle recursive rendering', async () => {
    const engine = new TemplateEngine();
    
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
    
    expect(result.output).toBe('<div><p>Level 1<span>Level 2</span></p></div>');
    expect(result.errors).toEqual([]);
  });

  it('should collect validation errors for invalid input', async () => {
    const engine = new TemplateEngine();
    // @ts-expect-error - purposely invalid input
    const result = await engine.render({ not: 'an array' });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toBeInstanceOf(ValidationError);
    expect(result.output).toBe('');
  });

  it('should collect extension errors in beforeRender', async () => {
    const badExtension = {
      key: 'bad',
      beforeRender: () => { throw new Error('beforeRender failed'); }
    };
    const engine = new TemplateEngine([badExtension]);
    const template: TemplateNode[] = [{ tag: 'div' }];
    const result = await engine.render(template);
    expect(result.errors.some(e => e instanceof ExtensionError && e.message.includes('beforeRender'))).toBe(true);
    expect(result.output).toBe('');
  });

  it('should collect extension errors in nodeHandler', async () => {
    const badExtension = {
      key: 'bad',
      nodeHandler: () => { throw new Error('nodeHandler failed'); }
    };
    const engine = new TemplateEngine([badExtension]);
    const template: TemplateNode[] = [{ tag: 'div' }];
    const result = await engine.render(template);
    expect(result.errors.some(e => e instanceof ExtensionError && e.message.includes('nodeHandler'))).toBe(true);
    expect(result.output).toBe('');
  });

  it('should collect extension errors in rootHandler', async () => {
    const badExtension = {
      key: 'bad',
      rootHandler: () => { throw new Error('rootHandler failed'); }
    };
    const engine = new TemplateEngine([badExtension]);
    const template: TemplateNode[] = [{ tag: 'div' }];
    const result = await engine.render(template);
    expect(result.errors.some(e => e instanceof ExtensionError && e.message.includes('rootHandler'))).toBe(true);
    expect(result.output).toBe('<div></div>');
  });

  it('should collect file output errors', async () => {
    const engine = new TemplateEngine();
    // Patch the file output manager to throw
    (engine as any).fileOutputManager.writeAllOutputs = async () => { throw new Error('file output failed'); };
    const template: TemplateNode[] = [{ tag: 'div' }];
    const result = await engine.render(template, { writeOutputFile: true });
    expect(result.errors.some(e => e instanceof FileOutputError)).toBe(true);
    expect(result.output).toBe('<div></div>');
  });
}); 