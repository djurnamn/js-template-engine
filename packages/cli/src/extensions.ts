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

/**
 * The targets the CLI can render to. `html` is the engine's own output and
 * takes no target extension.
 */
export const targetNames = ['react', 'vue', 'svelte', 'html'] as const;

/** The styling extension names the CLI can apply. */
export const stylingNames = ['bem', 'tailwind'] as const;

export type TargetName = (typeof targetNames)[number];
export type StylingName = (typeof stylingNames)[number];

/**
 * @deprecated Use `targetNames` instead. `frameworkNames` is kept as an alias
 * until the next major version.
 */
export const frameworkNames = ['react', 'vue', 'svelte'] as const;

/**
 * @deprecated Use `TargetName` instead. `FrameworkName` is kept as an alias
 * until the next major version.
 */
export type FrameworkName = Exclude<TargetName, 'html'>;

const targetFactories: Record<
  Exclude<TargetName, 'svelte' | 'html'>,
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
 * the target extension, if any.
 *
 * @param target - The target to render to; `html` or `undefined` renders
 *   HTML, which takes no target extension.
 * @param styling - Styling extension names, in application order.
 * @param bemOptions - Options forwarded to the BEM extension factory.
 * @param tailwindOptions - Options forwarded to the Tailwind extension factory.
 * @param svelteOptions - Options forwarded to the Svelte extension factory.
 * @returns Extension instances ready for `process()`.
 */
export function buildExtensions(
  target: TargetName | undefined,
  styling: readonly StylingName[],
  bemOptions: BemOptions = {},
  tailwindOptions: TailwindOptions = {},
  svelteOptions: SvelteOptions = {}
): Extension[] {
  const extensions: Extension[] = styling.map((name) =>
    name === 'bem' ? bem(bemOptions) : tailwind(tailwindOptions)
  );
  if (target !== undefined && target !== 'html') {
    extensions.push(
      target === 'svelte' ? svelte(svelteOptions) : targetFactories[target]()
    );
  }
  return extensions;
}

/**
 * Every target extension the CLI renders with, for validating a template
 * for all of them: a name any target's output declares is reserved, and
 * each target's own override checks run. `render` reserves their names too
 * (`reserveNamesOf`), so a prop's alias is the same for every target.
 *
 * @returns The React, Vue and Svelte extensions.
 */
export function everyTargetExtension(): Extension[] {
  return [react(), vue(), svelte()];
}
