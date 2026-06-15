/**
 * Vue extension for the JS Template Engine.
 *
 * Renders data-defined component templates as Vue Single File Components:
 * `process(template, { extensions: [vue()] })`.
 */
export { vue, type VueExtension } from './vue-extension';
export type { VueComponentOverride, VueNodeOverrides } from './overrides';
