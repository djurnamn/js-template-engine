import { describe, it, expect, vi } from 'vitest';
import { ExtensionManager } from '../../src/utils/ExtensionManager';
import type { TemplateNode, Extension } from '@js-template-engine/types';

describe('ExtensionManager', () => {
  it('calls beforeRender and afterRender hooks in order', () => {
    const calls: string[] = [];
    const ext1: Extension = {
      key: 'a',
      nodeHandler: (n) => n,
      beforeRender: () => calls.push('before-a'),
      afterRender: () => calls.push('after-a'),
    };
    const ext2: Extension = {
      key: 'b',
      nodeHandler: (n) => n,
      beforeRender: () => calls.push('before-b'),
      afterRender: () => calls.push('after-b'),
    };
    const mgr = new ExtensionManager([ext1, ext2]);
    mgr.callBeforeRender([], {} as any);
    mgr.callAfterRender([], {} as any);
    expect(calls).toEqual(['before-a', 'before-b', 'after-a', 'after-b']);
  });

  it('chains nodeHandler calls in order', () => {
    const ext1: Extension = {
      key: 'a',
      nodeHandler: (n) => ({ ...n, a: true }),
    };
    const ext2: Extension = {
      key: 'b',
      nodeHandler: (n) => ({ ...n, b: true }),
    };
    const mgr = new ExtensionManager([ext1, ext2]);
    const node: TemplateNode = { type: 'element', tag: 'div' };
    const result = mgr.callNodeHandlers(node) as any;
    expect(result.a).toBe(true);
    expect(result.b).toBe(true);
  });

  it('calls onNodeVisit for all extensions', () => {
    const calls: string[] = [];
    const ext1: Extension = {
      key: 'a',
      nodeHandler: (n) => n,
      onNodeVisit: () => calls.push('visit-a'),
    };
    const ext2: Extension = {
      key: 'b',
      nodeHandler: (n) => n,
      onNodeVisit: () => calls.push('visit-b'),
    };
    const mgr = new ExtensionManager([ext1, ext2]);
    mgr.callOnNodeVisit({ type: 'element', tag: 'div' });
    expect(calls).toEqual(['visit-a', 'visit-b']);
  });

  it('chains rootHandler calls and returns final result', () => {
    const ext1: Extension = {
      key: 'a',
      nodeHandler: (n) => n,
      rootHandler: (tpl) => tpl + 'A',
    };
    const ext2: Extension = {
      key: 'b',
      nodeHandler: (n) => n,
      rootHandler: (tpl) => tpl + 'B',
    };
    const mgr = new ExtensionManager([ext1, ext2]);
    const result = mgr.callRootHandlers('X', {} as any, {});
    expect(result).toBe('XAB');
  });

  it('chains onOutputWrite calls and returns final result', () => {
    const ext1: Extension = {
      key: 'a',
      nodeHandler: (n) => n,
      onOutputWrite: (out) => out + 'A',
    };
    const ext2: Extension = {
      key: 'b',
      nodeHandler: (n) => n,
      onOutputWrite: (out) => out + 'B',
    };
    const mgr = new ExtensionManager([ext1, ext2]);
    const result = mgr.callOnOutputWrite('X', {} as any);
    expect(result).toBe('XAB');
  });

  it('chains optionsHandler calls and merges options', () => {
    const ext1: Extension = {
      key: 'a',
      nodeHandler: (n) => n,
      optionsHandler: (def, opt) => ({ ...def, foo: (opt as any).foo || 'a' }),
    };
    const ext2: Extension = {
      key: 'b',
      nodeHandler: (n) => n,
      optionsHandler: (def, opt) => ({ ...def, bar: (opt as any).bar || 'b' }),
    };
    const mgr = new ExtensionManager([ext1, ext2]);
    const merged = mgr.callOptionsHandlers({} as any, { foo: 'x' } as any) as any;
    expect(merged.foo).toBe('x');
    expect(merged.bar).toBe('b');
  });
}); 