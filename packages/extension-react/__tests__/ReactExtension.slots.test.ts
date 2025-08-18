import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { ReactExtension } from '../src/index';
import type { ExtendedTemplate } from '@js-template-engine/types';

describe('ReactExtension - Slot Handling', () => {
  const extension = new ReactExtension();
  const engine = new TemplateEngine([extension]);

  it('transforms slot nodes to JSX expressions', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'slot',
          name: 'header'
        }]
      }],
      component: {
        name: 'TestComponent'
      }
    };
    
    const result = await engine.render(template, { language: 'typescript' });
    expect(result.output).toContain('{props.header}');
    expect(result.output).toContain('header?: React.ReactNode');
  });

  it('converts kebab-case slot names to camelCase props', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'slot',
          name: 'header-content'
        }]
      }],
      component: {
        name: 'TestComponent'
      }
    };
    
    const result = await engine.render(template, { language: 'typescript' });
    expect(result.output).toContain('{props.headerContent}');
    expect(result.output).toContain('headerContent?: React.ReactNode');
  });

  it('handles multiple slots in component', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [
          {
            type: 'slot',
            name: 'header'
          },
          {
            type: 'slot',
            name: 'footer'
          }
        ]
      }],
      component: {
        name: 'TestComponent'
      }
    };
    
    const result = await engine.render(template, { language: 'typescript' });
    expect(result.output).toContain('{props.header}');
    expect(result.output).toContain('{props.footer}');
    expect(result.output).toContain('header?: React.ReactNode');
    expect(result.output).toContain('footer?: React.ReactNode');
  });

  it('combines slot props with existing component props', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'slot',
          name: 'content'
        }]
      }],
      component: {
        name: 'TestComponent',
        props: {
          title: 'string',
          visible: 'boolean'
        }
      }
    };
    
    const result = await engine.render(template, { language: 'typescript' });
    expect(result.output).toContain('{props.content}');
    expect(result.output).toContain('title?: string');
    expect(result.output).toContain('visible?: boolean');
    expect(result.output).toContain('content?: React.ReactNode');
  });

  it('omits slot props interface when typescript is disabled', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'slot',
          name: 'header'
        }]
      }],
      component: {
        name: 'TestComponent'
      }
    };
    
    const result = await engine.render(template, { language: 'javascript' });
    expect(result.output).toContain('{props.header}');
    expect(result.output).not.toContain('interface TestComponentProps');
    expect(result.output).not.toContain('React.ReactNode');
  });

  it('sanitizes invalid slot names to valid JavaScript identifiers', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'slot',
          name: '123-invalid@name!'
        }]
      }],
      component: {
        name: 'TestComponent'
      }
    };
    
    const result = await engine.render(template, { language: 'typescript' });
    expect(result.output).toContain('{props._23InvalidName}');
    expect(result.output).toContain('_23InvalidName?: React.ReactNode');
  });

  it('includes props parameter when slots are present even without other props', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'slot',
          name: 'content'
        }]
      }],
      component: {
        name: 'TestComponent'
      }
    };
    
    const result = await engine.render(template, { language: 'typescript' });
    expect(result.output).toContain('= (props) => {');
    expect(result.output).toContain('TestComponentProps');
  });
});