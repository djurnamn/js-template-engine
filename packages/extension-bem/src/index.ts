/**
 * BEM extension for the JS Template Engine.
 *
 * Contributes BEM (block, element, modifier) classes to element nodes:
 * `process(template, { extensions: [bem()] })`.
 */
export { bem, type BemExtension, type BemOptions } from './bem-extension';
export type { BemNodeOverrides } from './overrides';
