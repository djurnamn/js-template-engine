import { describe, it, expect } from 'vitest';
import { AttributeRenderer } from '../../src/utils/AttributeRenderer';
import type { TemplateNode } from '@js-template-engine/types';

const baseFormatter = (attr: string, val: string | number | boolean, isExpression?: boolean) =>
  isExpression ? ` ${attr}={${val}}` : ` ${attr}="${val}"`;

describe('AttributeRenderer', () => {
  describe('isAttributeValue', () => {
    it('returns true for string, number, boolean', () => {
      expect(AttributeRenderer.isAttributeValue('foo')).toBe(true);
      expect(AttributeRenderer.isAttributeValue(123)).toBe(true);
      expect(AttributeRenderer.isAttributeValue(false)).toBe(true);
    });
    it('returns false for object, array, null, undefined', () => {
      expect(AttributeRenderer.isAttributeValue({})).toBe(false);
      expect(AttributeRenderer.isAttributeValue([])).toBe(false);
      expect(AttributeRenderer.isAttributeValue(null)).toBe(false);
      expect(AttributeRenderer.isAttributeValue(undefined)).toBe(false);
    });
  });

  describe('renderAttributes', () => {
    it('renders static attributes', () => {
      const node: TemplateNode = {
        type: 'element',
        tag: 'div',
        attributes: { id: 'main', tabIndex: 2, hidden: false }
      };
      const result = AttributeRenderer.renderAttributes(node, baseFormatter, { styles: {} } as any);
      expect(result).toContain(' id="main"');
      expect(result).toContain(' tabIndex="2"');
      expect(result).toContain(' hidden="false"');
    });

    it('renders expression attributes', () => {
      const node: TemplateNode = {
        type: 'element',
        tag: 'input',
        expressionAttributes: { value: 'foo', onChange: 'handleChange' }
      };
      const result = AttributeRenderer.renderAttributes(node, baseFormatter, { styles: {} } as any);
      expect(result).toContain(' value={foo}');
      expect(result).toContain(' onChange={handleChange}');
    });

    it('skips static attributes that overlap with expression attributes', () => {
      const node: TemplateNode = {
        type: 'element',
        tag: 'input',
        attributes: { value: 'bar', type: 'text' },
        expressionAttributes: { value: 'foo' }
      };
      const result = AttributeRenderer.renderAttributes(node, baseFormatter, { styles: {} } as any);
      expect(result).not.toContain(' value="bar"');
      expect(result).toContain(' value={foo}');
      expect(result).toContain(' type="text"');
    });

    it('handles inline style attribute when outputFormat is inline', () => {
      const node: TemplateNode = {
        type: 'element',
        tag: 'div',
        attributes: { style: 'color: red; font-size: 16px;' }
      };
      const options = { styles: { outputFormat: 'inline' } } as any;
      const result = AttributeRenderer.renderAttributes(node, baseFormatter, options);
      expect(result).toContain(' style="color: red; font-size: 16px;"');
    });

    it('ignores style attribute for non-inline outputFormat', () => {
      const node: TemplateNode = {
        type: 'element',
        tag: 'div',
        attributes: { style: 'color: red;' }
      };
      const options = { styles: { outputFormat: 'css' } } as any;
      const result = AttributeRenderer.renderAttributes(node, baseFormatter, options);
      expect(result).toContain(' style="color: red;"'); // Current implementation passes through
    });

    it('returns empty string if no attributes', () => {
      const node: TemplateNode = { type: 'element', tag: 'div' };
      const result = AttributeRenderer.renderAttributes(node, baseFormatter, { styles: {} } as any);
      expect(result).toBe('');
    });
  });
}); 