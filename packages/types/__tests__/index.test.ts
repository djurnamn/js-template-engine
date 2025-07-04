import { isTemplateNode, TemplateNode } from '../src/index';

describe('isTemplateNode', () => {
  it('returns true for valid element node', () => {
    const node = { type: 'element', tag: 'div' };
    expect(isTemplateNode(node)).toBe(true);
  });
  it('returns true for element node with type undefined', () => {
    const node = { tag: 'span' };
    expect(isTemplateNode(node)).toBe(true);
  });
  it('returns true for valid text node', () => {
    const node = { type: 'text', content: 'hello' };
    expect(isTemplateNode(node)).toBe(true);
  });
  it('returns true for valid slot node', () => {
    const node = { type: 'slot', name: 'header' };
    expect(isTemplateNode(node)).toBe(true);
  });
  it('returns false for invalid text node', () => {
    const node = { type: 'text', content: 123 };
    expect(isTemplateNode(node)).toBe(false);
  });
  it('returns false for invalid slot node', () => {
    const node = { type: 'slot', name: 123 };
    expect(isTemplateNode(node)).toBe(false);
  });
  it('returns false for element node missing tag', () => {
    const node = { type: 'element' };
    expect(isTemplateNode(node)).toBe(false);
  });
  it('returns false for completely invalid object', () => {
    const node = { foo: 'bar' };
    expect(isTemplateNode(node)).toBe(false);
  });
  it('returns false for null', () => {
    expect(isTemplateNode(null)).toBe(false);
  });
  it('returns false for non-object', () => {
    expect(isTemplateNode('string')).toBe(false);
    expect(isTemplateNode(123)).toBe(false);
    expect(isTemplateNode(true)).toBe(false);
  });
}); 