import { describe, it, expect, vi } from 'vitest';
import { NodeTraverser } from '../../src/engine/NodeTraverser';
import type { TemplateNode, Extension } from '@js-template-engine/types';

describe('NodeTraverser', () => {
  it('calls onNodeVisit for each node', () => {
    const calls: any[] = [];
    const ext: Extension = {
      key: 'test',
      nodeHandler: (node) => node,
      onNodeVisit: (node, ancestors) => {
        calls.push({ node, ancestors });
      }
    };
    const traverser = new NodeTraverser({ extensions: [ext] });
    const tree: TemplateNode[] = [
      {
        type: 'element',
        tag: 'div',
        children: [
          { type: 'element', tag: 'span', children: [{ type: 'text', content: 'Hello' }] }
        ]
      }
    ];
    traverser.traverseTree(tree);
    // Should be called for div, span, and text nodes
    expect(calls.length).toBe(3);
    expect(calls[0].node.tag).toBe('div');
    expect(calls[1].node.tag).toBe('span');
    expect(calls[2].node.type).toBe('text');
  });

  it('provides correct ancestor context for nested nodes', () => {
    const ancestorTags: string[][] = [];
    const ext: Extension = {
      key: 'test',
      nodeHandler: (node) => node,
      onNodeVisit: (node, ancestors = []) => {
        ancestorTags.push(ancestors.map(a => (a as any).tag).filter(Boolean));
      }
    };
    const traverser = new NodeTraverser({ extensions: [ext] });
    const tree: TemplateNode[] = [
      {
        type: 'element',
        tag: 'div',
        children: [
          { type: 'element', tag: 'span', children: [{ type: 'text', content: 'Hello' }] }
        ]
      }
    ];
    traverser.traverseTree(tree);
    // div: [], span: [div], text: [div, span]
    expect(ancestorTags[0]).toEqual([]);
    expect(ancestorTags[1]).toEqual(['div']);
    expect(ancestorTags[2]).toEqual(['div', 'span']);
  });

  it('returns a new tree structure with possible modifications', () => {
    const ext: Extension = {
      key: 'test',
      nodeHandler: (node) => node,
      onNodeVisit: (node) => {
        if (node.type === 'element') {
          node.attributes = { ...(node.attributes || {}), 'data-test': 'yes' };
        }
      }
    };
    const traverser = new NodeTraverser({ extensions: [ext] });
    const tree: TemplateNode[] = [
      {
        type: 'element',
        tag: 'div',
        children: [
          { type: 'element', tag: 'span', children: [{ type: 'text', content: 'Hello' }] }
        ]
      }
    ];
    const result = traverser.traverseTree(tree);
    expect(result[0].attributes).toBeDefined();
    expect(result[0].attributes!['data-test']).toBe('yes');
    expect(result[0].children![0].attributes!['data-test']).toBe('yes');
  });
}); 