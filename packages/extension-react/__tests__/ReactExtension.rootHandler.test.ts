import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { ReactExtension } from '../src/index';
import type { ExtendedTemplate, RootHandlerContext } from '@js-template-engine/types';
import type { ReactExtensionOptions } from '../src/types';

describe('ReactExtension - rootHandler', () => {
  const extension = new ReactExtension();

  const reactBaseTemplate: ExtendedTemplate = {
    template: [{
      type: 'element',
      tag: 'div',
      children: [{
        type: 'text',
        content: 'Hello'
      }]
    }],
    component: {
      name: 'TestComponent',
      props: {
        title: 'string'
      },
      imports: ['import React from "react";']
    }
  };

  it('renders a complete valid React component snapshot', async () => {
    const engine = new TemplateEngine([extension]);
    const result = await engine.render({
      ...reactBaseTemplate,
      component: {
        ...reactBaseTemplate.component,
        typescript: true
      }
    }, {
      extensions: [extension],
    });

    expect(result.output).toMatchInlineSnapshot(`
      "import React from "react";

      interface TestComponentProps {
        title: string
      }

      const TestComponent: React.FC<TestComponentProps> = (props) => {
        return (
          <div>Hello</div>
        );
      };

      export default TestComponent;"
    `);
  });

  it('renders props interface correctly when typescript is enabled', async () => {
    const engine = new TemplateEngine([extension]);
    const result = await engine.render({
      ...reactBaseTemplate,
      component: {
        ...reactBaseTemplate.component,
        typescript: true
      }
    }, {
      extensions: [extension],
    });

    expect(result.output).toContain('interface TestComponentProps');
    expect(result.output).toContain('title: string');
    expect(result.output).toContain('const TestComponent: React.FC<TestComponentProps>');
  });

  it('renders JavaScript component without TypeScript features when typescript is disabled', async () => {
    const engine = new TemplateEngine([extension]);
    const result = await engine.render({
      ...reactBaseTemplate,
      component: {
        ...reactBaseTemplate.component,
        typescript: false
      }
    }, {
      extensions: [extension],
    });

    expect(result.output).not.toContain('interface TestComponentProps');
    expect(result.output).toContain('const TestComponent = (props) => {');
    expect(result.output).not.toContain('React.FC');
  });

  it('renders JavaScript component by default when typescript flag is not set', async () => {
    const engine = new TemplateEngine([extension]);
    const result = await engine.render(reactBaseTemplate, {
      extensions: [extension],
    });

    expect(result.output).not.toContain('interface TestComponentProps');
    expect(result.output).toContain('const TestComponent = (props) => {');
    expect(result.output).not.toContain('React.FC');
  });

  it('wraps content in a functional React component', async () => {
    const engine = new TemplateEngine([extension]);
    const result = await engine.render({
      ...reactBaseTemplate,
      component: {
        ...reactBaseTemplate.component,
        typescript: true
      }
    }, {
      extensions: [extension],
    });

    expect(result.output).toContain('import React from "react"');
    expect(result.output).toContain('const TestComponent: React.FC<TestComponentProps>');
    expect(result.output).toContain('(props) => {');
    expect(result.output).toContain('return (');
    expect(result.output).toContain('<div>Hello</div>');
  });

  it('renders style block when styleOutput is provided', async () => {
    const template: ExtendedTemplate = {
      ...reactBaseTemplate,
      component: {
        ...reactBaseTemplate.component,
        typescript: true,
        extensions: {
          react: {
            styleOutput: '.test { color: red; }'
          }
        }
      }
    };

    const engine = new TemplateEngine([extension]);
    const result = await engine.render(template, {
      extensions: [extension],
    });

    expect(result.output).toContain('import \'./TestComponent.scss\'');
  });

  it('renders lang in style tag when styleLang is set', async () => {
    const template: ExtendedTemplate = {
      ...reactBaseTemplate,
      component: {
        ...reactBaseTemplate.component,
        typescript: true,
        extensions: {
          react: {
            styleOutput: '.test { color: red; }',
            styleLang: 'scss'
          }
        }
      }
    };

    const engine = new TemplateEngine([extension]);
    const result = await engine.render(template, {
      extensions: [extension],
    });

    expect(result.output).toContain('import \'./TestComponent.scss\'');
  });

  it('handles component name fallbacks correctly', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        typescript: true,
        props: {
          title: 'string'
        },
        imports: ['import React from "react";']
      }
    };

    const engine = new TemplateEngine([extension]);
    const result = await engine.render(template, {
      extensions: [extension],
      name: 'CustomComponent'
    });

    expect(result.output).toContain('const CustomComponent: React.FC<CustomComponentProps>');
  });

  it('handles multiple imports and deduplicates them', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        typescript: true,
        imports: [
          'import React from "react";',
          'import { useEffect } from "react";',
          'import { useState } from "react";',
          'import { Button } from "./components";'
        ]
      }
    };

    const engine = new TemplateEngine([extension]);
    const result = await engine.render(template, {
      extensions: [extension],
    });

    // Verify merged imports
    expect(result.output).toContain('import React, { useEffect, useState } from "react";');
    expect(result.output).toContain('import { Button } from "./components";');
  });

  it('renders a minimal React component without props or imports', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'Minimal',
        typescript: true
      }
    };

    const engine = new TemplateEngine([extension]);
    const result = await engine.render(template, {
      extensions: [extension],
    });

    expect(result.output).toContain('const Minimal: React.FC = () => {');
    expect(result.output).toContain('return (');
    expect(result.output).toContain('<div>Hello</div>');
  });

  it('omits style tag when no style output is provided', async () => {
    const template: ExtendedTemplate = {
      ...reactBaseTemplate,
      component: {
        ...reactBaseTemplate.component,
        typescript: true
      }
    };

    const engine = new TemplateEngine([extension]);
    const result = await engine.render(template, {
      extensions: [extension],
    });

    expect(result.output).not.toContain('import \'./TestComponent.scss\'');
  });

  it('omits style tag when style output is empty', async () => {
    const template: ExtendedTemplate = {
      ...reactBaseTemplate,
      component: {
        ...reactBaseTemplate.component,
        typescript: true,
        extensions: {
          react: {
            styleOutput: ''
          }
        }
      }
    };

    const engine = new TemplateEngine([extension]);
    const result = await engine.render(template, {
      extensions: [extension],
    });

    expect(result.output).not.toContain('import \'./TestComponent.scss\'');
  });

  it('should handle mixed string and object import definitions', async () => {
    const template: ExtendedTemplate = {
      template: [{
        type: 'element',
        tag: 'div',
        children: [{
          type: 'text',
          content: 'Hello'
        }]
      }],
      component: {
        name: 'TestComponent',
        typescript: true,
        imports: [
          'import React from "react";',
          { from: './components', named: ['Button', 'Input'] },
          { from: './utils', default: 'myUtil' }
        ]
      }
    };

    const engine = new TemplateEngine([extension]);
    const result = await engine.render(template, {
      extensions: [extension],
    });

    // Verify imports are properly formatted
    expect(result.output).toContain('import React from "react";');
    expect(result.output).toContain('import { Button, Input } from "./components";');
    expect(result.output).toContain('import myUtil from "./utils";');
  });
}); 