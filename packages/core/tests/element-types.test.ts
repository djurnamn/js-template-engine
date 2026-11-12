import { describe, expect, it } from 'vitest';

import { dynamicElementTypeOf, elementTypeOf } from '../src/element-types';

describe('elementTypeOf', () => {
  it('types an HTML tag, an SVG-only tag and a custom element', () => {
    expect(elementTypeOf('button')).toBe("HTMLElementTagNameMap['button']");
    expect(elementTypeOf('svg')).toBe("SVGElementTagNameMap['svg']");
    expect(elementTypeOf('a')).toBe("HTMLElementTagNameMap['a']");
    expect(elementTypeOf('my-widget')).toBe('HTMLElement');
  });
});

describe('dynamicElementTypeOf', () => {
  it('types a dynamic root by its default namespace only', () => {
    expect(dynamicElementTypeOf('button')).toBe('HTMLElement');
    expect(dynamicElementTypeOf('svg')).toBe('SVGElement');
  });
});
