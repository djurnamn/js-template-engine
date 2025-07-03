import { describe, it, expect, beforeEach } from 'vitest';
import { StyleManager } from '../../src/engine/StyleManager';
import type { TemplateNode } from '@js-template-engine/types';

const baseNode: TemplateNode = {
  type: 'element',
  tag: 'div',
  attributes: {},
  children: [],
};

describe('StyleManager', () => {
  let styleManager: StyleManager;

  beforeEach(() => {
    styleManager = new StyleManager(false);
  });

  it('processes a node with style definitions', () => {
    const node = {
      ...baseNode,
      attributes: { style: { color: 'red', fontSize: '16px' } }
    };
    styleManager.processNode(node);
    expect(styleManager.hasStyles()).toBe(true);
  });

  it('merges duplicate style definitions', () => {
    const node1 = {
      ...baseNode,
      attributes: { style: { color: 'red' } }
    };
    const node2 = {
      ...baseNode,
      attributes: { style: { color: 'blue', fontWeight: 'bold' } }
    };
    styleManager.processNode(node1);
    styleManager.processNode(node2);
    const output = styleManager.generateOutput({ styles: { outputFormat: 'css' } } as any, [node1, node2]);
    expect(output).toContain('color');
    expect(output).toContain('font-weight');
  });

  it('generates CSS output', () => {
    const node = {
      ...baseNode,
      attributes: { style: { color: 'red' } }
    };
    styleManager.processNode(node);
    const output = styleManager.generateOutput({ styles: { outputFormat: 'css' } } as any, [node]);
    expect(output).toContain('color: red');
  });

  it('generates SCSS output', () => {
    const node = {
      ...baseNode,
      attributes: { style: { color: 'red' } }
    };
    styleManager.processNode(node);
    const output = styleManager.generateOutput({ styles: { outputFormat: 'scss' } } as any, [node]);
    expect(output).toContain('color: red');
  });

  it('generates inline style string', () => {
    const node = {
      ...baseNode,
      attributes: { style: { color: 'red', fontSize: '16px' } }
    };
    styleManager.processNode(node);
    const inline = styleManager.getInlineStyles(node);
    expect(inline).toContain('color: red');
    expect(inline).toContain('font-size: 16px');
  });

  it('returns null for getInlineStyles if no styles', () => {
    const node = { ...baseNode };
    expect(styleManager.getInlineStyles(node)).toBeNull();
  });

  it('supports style plugins', () => {
    const plugin = {
      onProcessNode: (node: any) => {
        if (node.attributes && node.attributes.style) {
          node.attributes.style.background = 'blue';
        }
        return undefined;
      }
    };
    styleManager = new StyleManager(false, [plugin]);
    const node = {
      ...baseNode,
      attributes: { style: { color: 'red' } }
    };
    styleManager.processNode(node);
    const output = styleManager.generateOutput({ styles: { outputFormat: 'css' } } as any, [node]);
    expect(output).toContain('background: blue');
  });

  it('handles empty and invalid style definitions gracefully', () => {
    const node = { ...baseNode, attributes: { style: null as any } };
    expect(() => styleManager.processNode(node)).not.toThrow();
    expect(styleManager.hasStyles()).toBe(false);
  });
}); 