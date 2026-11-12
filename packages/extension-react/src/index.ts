/**
 * React extension for the JS Template Engine.
 *
 * Renders data-defined component templates as React function components:
 * `process(template, { extensions: [react()] })`.
 */
export { react, type ReactExtension } from './react-extension';
/**
 * @deprecated Import `normalizeSlotName` from
 * `@js-template-engine/core/emitter`; removed in 3.0.0.
 */
export { normalizeSlotName } from '@js-template-engine/core/emitter';
export { attributeName, REACT_ATTRIBUTE_NAMES } from './attribute-names';
export type { ReactComponentOverride, ReactNodeOverrides } from './overrides';
