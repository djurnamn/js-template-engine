import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../src/engine';
import type { TemplateNode, RenderOptions } from '@js-template-engine/types';

describe('TemplateEngine', () => {
  it('should initialize with default options', () => {
    const engine = new TemplateEngine();
    expect(engine).toBeInstanceOf(TemplateEngine);
  });

  it('should render a simple template node', async () => {
    const engine = new TemplateEngine();
    const nodes: TemplateNode[] = [{
      type: 'element',
      tag: 'div',
      attributes: {
        class: 'test-class'
      },
      children: [{
        type: 'text',
        content: 'Hello World'
      }]
    }];

    const options: RenderOptions = {
      fileExtension: '.html'
    };

    const result = await engine.render(nodes, options);
    expect(result).toContain('<div class="test-class">Hello World</div>');
  });

  it('should handle nested template nodes', async () => {
    const engine = new TemplateEngine();
    const nodes: TemplateNode[] = [{
      type: 'element',
      tag: 'div',
      children: [
        {
          type: 'element',
          tag: 'span',
          attributes: {
            class: 'nested'
          },
          children: [{
            type: 'text',
            content: 'Nested Content'
          }]
        }
      ]
    }];

    const options: RenderOptions = {
      fileExtension: '.html'
    };

    const result = await engine.render(nodes, options);
    expect(result).toContain('<div><span class="nested">Nested Content</span></div>');
  });

  it('should apply style processing when enabled', async () => {
    const engine = new TemplateEngine();
    const nodes: TemplateNode[] = [{
      type: 'element',
      tag: 'div',
      attributes: {
        style: {
          color: 'red',
          fontSize: '16px'
        }
      },
      children: [{
        type: 'text',
        content: 'Styled Content'
      }]
    }];

    const options: RenderOptions = {
      fileExtension: '.html',
      styles: {
        outputFormat: 'inline'
      }
    };

    const result = await engine.render(nodes, options);
    expect(result).toBe('<div style="color: red; font-size: 16px">Styled Content</div>');
  });
});
