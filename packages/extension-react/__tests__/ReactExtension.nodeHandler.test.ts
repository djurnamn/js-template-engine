import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { ReactExtension } from '../src';
import type { ExtendedTemplate } from '@js-template-engine/types';

describe('ReactExtension - nodeHandler', () => {
  const extension = new ReactExtension();
  const engine = new TemplateEngine([extension]);

  it('transforms HTML attributes to React attributes', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          class: 'container',
          for: 'input'
        },
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import React from "react";']
      }
    };
    const output = await engine.render(template);
    expect(output).toContain('className="container"');
    expect(output).toContain('htmlFor="input"');
  });

  it('handles expression attributes correctly', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'button',
        attributes: {
          onclick: 'handleClick'
        },
        extensions: {
          react: {
            expressionAttributes: {
              onClick: 'handleClick'
            }
          }
        },
        children: [{
          type: 'text',
          content: 'Click me'
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import React from "react";']
      }
    };
    const output = await engine.render(template);
    expect(output).toContain('onClick={handleClick}');
    expect(output).not.toContain('onclick="handleClick"');
  });

  it('preserves custom React attributes', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          'data-testid': 'test'
        },
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import React from "react";']
      }
    };
    const output = await engine.render(template);
    expect(output).toContain('data-testid="test"');
  });

  it('handles nested element transformations', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        attributes: {
          class: 'outer'
        },
        children: [{
          type: 'element',
          tag: 'span',
          attributes: {
            class: 'inner'
          },
          children: [{
            type: 'text',
            content: 'Hello'
          }]
        }]
      }],
      component: {
        name: 'TestComponent',
        imports: ['import React from "react";']
      }
    };
    const output = await engine.render(template);
    expect(output).toContain('className="outer"');
    expect(output).toContain('className="inner"');
  });
}); 