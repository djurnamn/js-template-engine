import { bem, type BemOptions } from '@js-template-engine/extension-bem';
import { react } from '@js-template-engine/extension-react';
import {
  svelte,
  type SvelteOptions,
} from '@js-template-engine/extension-svelte';
import {
  tailwind,
  type TailwindOptions,
} from '@js-template-engine/extension-tailwind';
import { vue } from '@js-template-engine/extension-vue';
import type { Extension } from '@js-template-engine/types';

/** The framework names the CLI can render with. */
export const frameworkNames = ['react', 'vue', 'svelte'] as const;

/** The styling extension names the CLI can apply. */
export const stylingNames = ['bem', 'tailwind'] as const;

export type FrameworkName = (typeof frameworkNames)[number];
export type StylingName = (typeof stylingNames)[number];

const frameworkFactories: Record<
  Exclude<FrameworkName, 'svelte'>,
  () => Extension
> = {
  react,
  vue,
};

/**
 * Builds the extension list for one `process()` call.
 *
 * Styling extensions come first, in the order they were named on the
 * command line - the order their classes are contributed in - followed by
 * the framework extension, if any.
 *
 * @param framework - The framework to render with; `undefined` renders HTML.
 * @param styling - Styling extension names, in application order.
 * @param bemOptions - Options forwarded to the BEM extension factory.
 * @param tailwindOptions - Options forwarded to the Tailwind extension factory.
 * @param svelteOptions - Options forwarded to the Svelte extension factory.
 * @returns Extension instances ready for `process()`.
 */
export function buildExtensions(
  framework: FrameworkName | undefined,
  styling: readonly StylingName[],
  bemOptions: BemOptions = {},
  tailwindOptions: TailwindOptions = {},
  svelteOptions: SvelteOptions = {}
): Extension[] {
  const extensions: Extension[] = styling.map((name) =>
    name === 'bem' ? bem(bemOptions) : tailwind(tailwindOptions)
  );
  if (framework !== undefined) {
    extensions.push(
      framework === 'svelte'
        ? svelte(svelteOptions)
        : frameworkFactories[framework]()
    );
  }
  return extensions;
}
