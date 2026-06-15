/**
 * Svelte extension for the JS Template Engine.
 *
 * Renders data-defined component templates as Svelte components:
 * `process(template, { extensions: [svelte()] })`.
 */
export { svelte, type SvelteExtension } from './svelte-extension';
export type { SvelteNodeOverrides } from './overrides';
