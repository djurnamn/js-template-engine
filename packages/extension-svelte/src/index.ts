/**
 * Svelte extension for the JS Template Engine.
 *
 * Renders data-defined component templates as Svelte components:
 * `process(template, { extensions: [svelte()] })`.
 */
export {
  svelte,
  svelteModes,
  type SvelteExtension,
  type SvelteMode,
  type SvelteOptions,
} from './svelte-extension';
export type { SvelteComponentOverride, SvelteNodeOverrides } from './overrides';
