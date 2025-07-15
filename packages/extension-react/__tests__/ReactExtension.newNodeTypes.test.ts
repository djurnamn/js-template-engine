import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { ReactExtension } from '../src';
import type { ExtendedTemplate } from '@js-template-engine/types';

describe('ReactExtension - New Node Types', () => {
  const extension = new ReactExtension();
  const engine = new TemplateEngine([extension]);

  describe('Comment Node', () => {
    it('transforms comment nodes to JSX comments', async () => {
      const template: ExtendedTemplate = {
        template: [{
          tag: 'div',
          children: [{
            type: 'comment',
            content: 'This is a comment'
          }]
        }],
        component: {
          name: 'TestComponent',
          imports: ['import React from "react";']
        }
      };
      const result = await engine.render(template);
      expect(result.output).toContain('{/* This is a comment */}');
    });
  });

  describe('Fragment Node', () => {
    it('transforms fragment nodes to React.Fragment', async () => {
      const template: ExtendedTemplate = {
        template: [{
          type: 'fragment',
          children: [
            { tag: 'div', children: [{ type: 'text', content: 'First' }] },
            { tag: 'div', children: [{ type: 'text', content: 'Second' }] }
          ]
        }],
        component: {
          name: 'TestComponent',
          imports: ['import React from "react";']
        }
      };
      const result = await engine.render(template);
      expect(result.output).toContain('<React.Fragment>');
      expect(result.output).toContain('First');
      expect(result.output).toContain('Second');
    });
  });

  describe('If Node', () => {
    it('transforms if nodes to JSX conditionals', async () => {
      const template: ExtendedTemplate = {
        template: [{
          type: 'if',
          condition: 'isVisible',
          then: [{ tag: 'div', children: [{ type: 'text', content: 'Visible' }] }]
        }],
        component: {
          name: 'TestComponent',
          props: { isVisible: 'boolean' },
          imports: ['import React from "react";']
        }
      };
      const result = await engine.render(template);
      expect(result.output).toContain('{props.isVisible &&');
      expect(result.output).toContain('Visible');
    });

    it('transforms if-else nodes to ternary operators', async () => {
      const template: ExtendedTemplate = {
        template: [{
          type: 'if',
          condition: 'showFirst',
          then: [{ tag: 'div', children: [{ type: 'text', content: 'First' }] }],
          else: [{ tag: 'div', children: [{ type: 'text', content: 'Second' }] }]
        }],
        component: {
          name: 'TestComponent',
          props: { showFirst: 'boolean' },
          imports: ['import React from "react";']
        }
      };
      const result = await engine.render(template);
      expect(result.output).toContain('{props.showFirst ?');
      expect(result.output).toContain('First');
      expect(result.output).toContain('Second');
    });
  });

  describe('For Node', () => {
    it('transforms for nodes to JSX map with keys', async () => {
      const template: ExtendedTemplate = {
        template: [{
          type: 'for',
          items: 'items',
          item: 'item',
          index: 'index',
          key: 'item.id',
          children: [{ tag: 'div', children: [{ type: 'text', content: 'Item' }] }]
        }],
        component: {
          name: 'TestComponent',
          props: { items: 'any[]' },
          imports: ['import React from "react";']
        }
      };
      const result = await engine.render(template);
      expect(result.output).toContain('{props.items.map((item, index) =>');
      expect(result.output).toContain('<React.Fragment key={item.id}>');
      expect(result.output).toContain('Item');
    });

    it('handles for nodes without explicit key', async () => {
      const template: ExtendedTemplate = {
        template: [{
          type: 'for',
          items: 'data',
          item: 'entry',
          children: [{ tag: 'span', children: [{ type: 'text', content: 'Entry' }] }]
        }],
        component: {
          name: 'TestComponent',
          props: { data: 'any[]' },
          imports: ['import React from "react";']
        }
      };
      const result = await engine.render(template);
      expect(result.output).toContain('{props.data.map((entry, index) =>');
      expect(result.output).toContain('<React.Fragment key={index}>');
    });
  });

  describe('Nested New Node Types', () => {
    it('handles if nodes inside for nodes', async () => {
      const template: ExtendedTemplate = {
        template: [{
          type: 'for',
          items: 'items',
          item: 'item',
          children: [{
            type: 'if',
            condition: 'item.visible',
            then: [{ tag: 'div', children: [{ type: 'text', content: 'Visible Item' }] }]
          }]
        }],
        component: {
          name: 'TestComponent',
          props: { items: 'any[]' },
          imports: ['import React from "react";']
        }
      };
      const result = await engine.render(template);
      expect(result.output).toContain('{props.items.map');
      expect(result.output).toContain('{item.visible &&'); // Note: not props.item.visible since it's loop variable
    });

    it('handles comments in conditional nodes', async () => {
      const template: ExtendedTemplate = {
        template: [{
          type: 'if',
          condition: 'debug',
          then: [{
            type: 'comment',
            content: 'Debug mode enabled'
          }]
        }],
        component: {
          name: 'TestComponent',
          props: { debug: 'boolean' },
          imports: ['import React from "react";']
        }
      };
      const result = await engine.render(template);
      expect(result.output).toContain('{props.debug &&');
      expect(result.output).toContain('{/* Debug mode enabled */}');
    });
  });
});