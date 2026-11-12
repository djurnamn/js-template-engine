/**
 * Elements that exist only in SVG. A tag both namespaces define (`a`,
 * `script`, `style`, `title`) is typed as its HTML element.
 */
const SVG_ONLY_TAGS = new Set([
  'animate',
  'animateMotion',
  'animateTransform',
  'circle',
  'clipPath',
  'defs',
  'desc',
  'ellipse',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feImage',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
  'filter',
  'foreignObject',
  'g',
  'image',
  'line',
  'linearGradient',
  'marker',
  'mask',
  'metadata',
  'mpath',
  'path',
  'pattern',
  'polygon',
  'polyline',
  'radialGradient',
  'rect',
  'set',
  'stop',
  'svg',
  'switch',
  'symbol',
  'text',
  'textPath',
  'tspan',
  'use',
  'view',
]);

/**
 * The DOM element type an intrinsic tag renders: its `HTMLElementTagNameMap`
 * entry, its `SVGElementTagNameMap` entry for an SVG-only tag, or
 * `HTMLElement` for a custom element.
 *
 * @param tag - The intrinsic tag name.
 * @returns The element type expression.
 * @example
 * elementTypeOf('button'); // "HTMLElementTagNameMap['button']"
 * elementTypeOf('svg'); // "SVGElementTagNameMap['svg']"
 */
export function elementTypeOf(tag: string): string {
  if (SVG_ONLY_TAGS.has(tag)) {
    return `SVGElementTagNameMap['${tag}']`;
  }
  if (tag.includes('-')) {
    return 'HTMLElement';
  }
  return `HTMLElementTagNameMap['${tag}']`;
}

/**
 * The element type a dynamic root binds, whose rendered tag is known only at
 * runtime: `SVGElement` when its default is SVG-only, `HTMLElement` otherwise.
 *
 * @param defaultTag - The dynamic tag's static default.
 * @returns The element type expression.
 */
export function dynamicElementTypeOf(defaultTag: string): string {
  return SVG_ONLY_TAGS.has(defaultTag) ? 'SVGElement' : 'HTMLElement';
}
