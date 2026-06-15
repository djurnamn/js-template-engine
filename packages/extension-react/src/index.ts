/**
 * React extension for the JS Template Engine.
 *
 * Renders data-defined component templates as React function components:
 * `process(template, { extensions: [react()] })`.
 */
export { react, type ReactExtension } from './react-extension';
export { normalizeSlotName } from './props';
export type { ReactNodeOverrides } from './overrides';
